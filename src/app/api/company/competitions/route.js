import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';
import { App } from '@octokit/app';
import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const user = await requireRole(req, ['company_admin', 'company_employee']);
    const companyId = user.company_id;

    if (!companyId) {
      return NextResponse.json({ error: 'Company association not found' }, { status: 403 });
    }

    // Verify company status
    const compCheck = await pool.query('SELECT is_verified FROM companies WHERE id = $1', [companyId]);
    if (compCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Company details not found' }, { status: 404 });
    }

    const company = compCheck.rows[0];
    if (!company.is_verified) {
      return NextResponse.json(
        { error: 'Your company details must be verified by a Platform Admin before posting hiring competitions.' },
        { status: 403 }
      );
    }

    // Verify GitHub App installation exists before allowing competition creation
    const installCheck = await pool.query(
      'SELECT org_login, installation_id FROM installations WHERE company_id = $1 AND is_deleted = false LIMIT 1',
      [companyId]
    );
    if (installCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Connect your GitHub organization before publishing a challenge' },
        { status: 400 }
      );
    }
    const { org_login: orgLogin, installation_id: installationId } = installCheck.rows[0];

    const { title, taskDescription, language, skillsRequired, experienceRequired, otherRequirements } = await req.json();

    if (!title || !taskDescription || !language || !experienceRequired) {
      return NextResponse.json({ error: 'Title, task description, language, and experience requirement are required' }, { status: 400 });
    }

    const allowedLanguages = ['Python', 'JavaScript/TypeScript', 'C++'];
    if (!allowedLanguages.includes(language)) {
      return NextResponse.json({ error: `Language must be one of: ${allowedLanguages.join(', ')}` }, { status: 400 });
    }

    const skillsArray = Array.isArray(skillsRequired)
      ? skillsRequired
      : (skillsRequired ? skillsRequired.split(',').map(s => s.trim()).filter(Boolean) : []);

    // 1. Insert competition with status 'pending' and github_template_repo = null
    const insertRes = await pool.query(
      `INSERT INTO competitions (company_id, title, task_description, language, skills_required, experience_required, other_requirements, github_template_repo, github_setup_status, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, 'pending', $8) 
       RETURNING id, title, task_description as "taskDescription", language, skills_required as "skillsRequired", 
                 experience_required as "experienceRequired", other_requirements as "otherRequirements", github_template_repo as "githubTemplateRepo", github_setup_status as "githubSetupStatus", created_at as "createdAt"`,
      [companyId, title, taskDescription, language, skillsArray, experienceRequired, otherRequirements || '', user.id]
    );

    const competition = insertRes.rows[0];

    // 2. Perform background/inline GitHub Template Repo creation
    const appId = process.env.GITHUB_APP_ID;
    let rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY;

    if (!rawPrivateKey && process.env.GITHUB_PRIVATE_KEY_PATH) {
      try {
        const keyPath = path.resolve(process.cwd(), process.env.GITHUB_PRIVATE_KEY_PATH);
        if (fs.existsSync(keyPath)) {
          rawPrivateKey = fs.readFileSync(keyPath, 'utf8');
        }
      } catch (err) {
        console.error('Failed to read private key for auto-provisioning:', err);
      }
    }

    if (!appId || !rawPrivateKey) {
      console.error('GitHub App credentials missing on the server. Setting competition status to failed.');
      await pool.query('UPDATE competitions SET github_setup_status = \'failed\' WHERE id = $1', [competition.id]);
      competition.githubSetupStatus = 'failed';
    } else {
      try {
        // Slugify the title to generate the repo name
        const slug = title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '') // strip special chars
          .replace(/\s+/g, '-')          // spaces to hyphens
          .replace(/-+/g, '-');          // single hyphens
        
        const repoName = `${slug}-${competition.id}-template`;

        const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
        const app = new App({
          appId,
          privateKey
        });

        const octokit = await app.getInstallationOctokit(parseInt(installationId, 10));

        // Create the repository in organization
        console.log(`[AUTO-TEMPLATE] Creating repository ${orgLogin}/${repoName}`);
        await octokit.rest.repos.createInOrg({
          org: orgLogin,
          name: repoName,
          private: true,
          auto_init: true
        });

        // Wait briefly for GitHub to initialize default files
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Format README.md
        const readmeContent = `# ${title}

## Task Description
${taskDescription}

## Requirements
- **Target Language**: ${language}
- **Experience level**: ${experienceRequired}
- **Skills**: ${skillsArray.join(', ')}

## Additional Details
${otherRequirements || 'None'}
`;

        // Get readme file SHA if it exists
        let readmeSha = undefined;
        try {
          const readmeRes = await octokit.rest.repos.getContent({
            owner: orgLogin,
            repo: repoName,
            path: 'README.md'
          });
          readmeSha = readmeRes.data.sha;
        } catch (e) {
          // ignore
        }

        // Write the README.md content
        console.log(`[AUTO-TEMPLATE] Updating README.md for ${repoName}`);
        await octokit.rest.repos.createOrUpdateFileContents({
          owner: orgLogin,
          repo: repoName,
          path: 'README.md',
          message: 'Initialize challenge instructions',
          content: Buffer.from(readmeContent).toString('base64'),
          sha: readmeSha
        });

        // Mark repository as template
        console.log(`[AUTO-TEMPLATE] Setting ${repoName} as template repository`);
        const updateRes = await octokit.rest.repos.update({
          owner: orgLogin,
          repo: repoName,
          is_template: true
        });

        const templateRepoUrl = updateRes.data.html_url || `https://github.com/${orgLogin}/${repoName}`;

        // Save successfully created template back to DB
        await pool.query(
          'UPDATE competitions SET github_template_repo = $1, github_setup_status = \'completed\' WHERE id = $2',
          [templateRepoUrl, competition.id]
        );
        competition.githubTemplateRepo = templateRepoUrl;
        competition.githubSetupStatus = 'completed';
      } catch (gitErr) {
        console.error('[AUTO-TEMPLATE] GitHub Auto-Provisioning failed:', gitErr);
        await pool.query('UPDATE competitions SET github_setup_status = \'failed\' WHERE id = $1', [competition.id]);
        competition.githubSetupStatus = 'failed';
      }
    }

    await logAudit({
      action: 'CREATE_COMPETITION',
      performedBy: user.id,
      targetType: 'Competition',
      targetId: competition.id,
      details: `Competition "${title}" created by company ID ${companyId} with GitHub setup status: ${competition.githubSetupStatus}`
    });

    const formattedCompetition = {
      _id: competition.id.toString(),
      id: competition.id,
      title: competition.title,
      taskDescription: competition.taskDescription,
      language: competition.language,
      skillsRequired: competition.skillsRequired,
      experienceRequired: competition.experienceRequired,
      otherRequirements: competition.otherRequirements,
      githubTemplateRepo: competition.githubTemplateRepo,
      githubSetupStatus: competition.githubSetupStatus,
      createdAt: competition.createdAt
    };

    return NextResponse.json({ message: 'Hiring competition created successfully!', competition: formattedCompetition }, { status: 201 });
  } catch (err) {
    console.error('Create Competition API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create competition' }, { status: 500 });
  }
}
