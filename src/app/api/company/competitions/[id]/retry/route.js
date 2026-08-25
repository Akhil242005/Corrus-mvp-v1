import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';
import { App } from '@octokit/app';
import fs from 'fs';
import path from 'path';

export async function POST(req, { params }) {
  try {
    const user = await requireRole(req, ['company_admin', 'company_employee']);
    const companyId = user.company_id;
    const { id: competitionId } = params;

    if (!companyId) {
      return NextResponse.json({ error: 'Company association not found' }, { status: 403 });
    }

    // Verify competition owner and details
    const compRes = await pool.query(
      `SELECT c.*, i.org_login, i.installation_id 
       FROM competitions c
       LEFT JOIN installations i ON c.company_id = i.company_id AND i.is_deleted = false
       WHERE c.id = $1 AND c.company_id = $2 AND c.is_deleted = false`,
      [competitionId, companyId]
    );

    if (compRes.rows.length === 0) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    const competition = compRes.rows[0];

    if (competition.github_setup_status === 'completed') {
      return NextResponse.json({ message: 'GitHub template is already set up.', url: competition.github_template_repo }, { status: 200 });
    }

    if (!competition.org_login || !competition.installation_id) {
      return NextResponse.json({ error: 'Connect your GitHub organization before retrying setup' }, { status: 400 });
    }

    // GitHub credentials
    const appId = process.env.GITHUB_APP_ID;
    let rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY;

    if (!rawPrivateKey && process.env.GITHUB_PRIVATE_KEY_PATH) {
      try {
        const keyPath = path.resolve(process.cwd(), process.env.GITHUB_PRIVATE_KEY_PATH);
        if (fs.existsSync(keyPath)) {
          rawPrivateKey = fs.readFileSync(keyPath, 'utf8');
        }
      } catch (err) {
        console.error('Failed to read private key for retry-provision:', err);
      }
    }

    if (!appId || !rawPrivateKey) {
      return NextResponse.json({ error: 'GitHub App credentials are missing on the server' }, { status: 500 });
    }

    // Provisioning execution
    try {
      const slug = competition.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
      
      const repoName = `${slug}-${competition.id}-template`;

      const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
      const app = new App({
        appId,
        privateKey
      });

      const octokit = await app.getInstallationOctokit(parseInt(competition.installation_id, 10));

      // 1. Create the repository (if it doesn't already exist)
      let repoExists = false;
      try {
        await octokit.rest.repos.get({
          owner: competition.org_login,
          repo: repoName
        });
        repoExists = true;
      } catch (e) {
        // repo doesn't exist
      }

      if (!repoExists) {
        console.log(`[RETRY-TEMPLATE] Creating repository ${competition.org_login}/${repoName}`);
        await octokit.rest.repos.createInOrg({
          org: competition.org_login,
          name: repoName,
          private: true,
          auto_init: true
        });
        // wait for init
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // 2. Format README.md
      const skillsArray = Array.isArray(competition.skills_required) ? competition.skills_required : [];
      const readmeContent = `# ${competition.title}

## Task Description
${competition.task_description}

## Requirements
- **Target Language**: ${competition.language}
- **Experience level**: ${competition.experience_required}
- **Skills**: ${skillsArray.join(', ')}

## Additional Details
${competition.other_requirements || 'None'}
`;

      let readmeSha = undefined;
      try {
        const readmeRes = await octokit.rest.repos.getContent({
          owner: competition.org_login,
          repo: repoName,
          path: 'README.md'
        });
        readmeSha = readmeRes.data.sha;
      } catch (e) {
        // ignore
      }

      console.log(`[RETRY-TEMPLATE] Updating README.md for ${repoName}`);
      await octokit.rest.repos.createOrUpdateFileContents({
        owner: competition.org_login,
        repo: repoName,
        path: 'README.md',
        message: 'Initialize challenge instructions',
        content: Buffer.from(readmeContent).toString('base64'),
        sha: readmeSha
      });

      // 3. Mark as template repository
      console.log(`[RETRY-TEMPLATE] Setting ${repoName} as template repository`);
      const updateRes = await octokit.rest.repos.update({
        owner: competition.org_login,
        repo: repoName,
        is_template: true
      });

      const templateRepoUrl = updateRes.data.html_url || `https://github.com/${competition.org_login}/${repoName}`;

      await pool.query(
        'UPDATE competitions SET github_template_repo = $1, github_setup_status = \'completed\' WHERE id = $2',
        [templateRepoUrl, competition.id]
      );

      await logAudit({
        action: 'RETRY_COMPETITION_GITHUB',
        performedBy: user.id,
        targetType: 'Competition',
        targetId: competition.id,
        details: `GitHub template setup retried and successfully completed for competition ID ${competition.id}`
      });

      return NextResponse.json({
        message: 'GitHub template repository successfully set up!',
        githubTemplateRepo: templateRepoUrl,
        githubSetupStatus: 'completed'
      }, { status: 200 });

    } catch (gitErr) {
      console.error('[RETRY-TEMPLATE] GitHub retry provisioning failed:', gitErr);
      await pool.query('UPDATE competitions SET github_setup_status = \'failed\' WHERE id = $1', [competition.id]);
      return NextResponse.json({ error: `GitHub Retry Failed: ${gitErr.message}` }, { status: 400 });
    }

  } catch (err) {
    console.error('Retry competition error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
