import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authenticateToken, logAudit } from '@/lib/auth';
import { App } from '@octokit/app';
import fs from 'fs';
import path from 'path';
import { getCanonicalId } from '@/lib/idMapper';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-');        // Replace multiple - with single -
}

function parseTemplateRepo(str) {
  if (!str) return null;
  const cleanStr = str.trim().replace(/\.git$/, '');
  const urlParts = cleanStr.split('/');
  if (urlParts.length >= 2) {
    const repo = urlParts[urlParts.length - 1];
    const owner = urlParts[urlParts.length - 2].split(':').pop(); // Handle git@github.com:owner
    return { owner, repo };
  }
  return null;
}

export async function POST(req, { params }) {
  const dbClient = await pool.connect();
  try {
    const user = await authenticateToken(req);
    const { id: competitionIdStr } = await params;
    const competitionId = parseInt(competitionIdStr, 10);

    if (isNaN(competitionId)) {
      return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
    }

    // Start database transaction
    await dbClient.query('BEGIN');

    // 1. Fetch enrolling candidate info to verify github_username
    const userRes = await dbClient.query(
      'SELECT github_username, email FROM users WHERE id = $1 AND is_deleted = false',
      [user.userId]
    );
    if (userRes.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    const githubUsername = userRes.rows[0].github_username;
    if (!githubUsername) {
      await dbClient.query('ROLLBACK');
      return NextResponse.json({ error: 'GitHub sign-in is required to enroll in this competition.' }, { status: 400 });
    }

    // 2. Fetch competition detail and associated company GitHub installation
    const compQuery = `
      SELECT c.id, c.title, c.company_id, c.github_template_repo,
             i.installation_id, i.org_login
      FROM competitions c
      LEFT JOIN installations i ON c.company_id = i.company_id AND i.is_deleted = false
      WHERE c.id = $1 AND c.is_deleted = false
    `;
    const compRes = await dbClient.query(compQuery, [competitionId]);
    if (compRes.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    const competition = compRes.rows[0];

    // If company hasn't installed GitHub App or template repo is missing, block enrollment
    if (!competition.installation_id || !competition.github_template_repo) {
      await dbClient.query('ROLLBACK');
      return NextResponse.json({ error: "This company hasn't completed GitHub setup yet" }, { status: 400 });
    }

    // 3. Verify if already enrolled
    const enrollRes = await dbClient.query(
      'SELECT 1 FROM competition_enrollments WHERE competition_id = $1 AND user_id = $2',
      [competitionId, user.userId]
    );

    if (enrollRes.rows.length > 0) {
      await dbClient.query('ROLLBACK');
      return NextResponse.json({ error: 'You are already enrolled in this competition.' }, { status: 400 });
    }

    // Parse template repository info
    const parsedTemplate = parseTemplateRepo(competition.github_template_repo);
    if (!parsedTemplate) {
      await dbClient.query('ROLLBACK');
      return NextResponse.json({ error: 'Invalid template repository configuration' }, { status: 400 });
    }

    // Generate repository name: candidateid + competitionid
    const candidateCanonicalId = getCanonicalId('candidate', user.userId).toLowerCase();
    const competitionCanonicalId = getCanonicalId('challenge', competitionId).toLowerCase();
    const repoName = `${candidateCanonicalId}-${competitionCanonicalId}`;

    const appId = process.env.GITHUB_APP_ID;
    let rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY;

    if (!rawPrivateKey && process.env.GITHUB_PRIVATE_KEY_PATH) {
      try {
        const keyPath = path.resolve(process.cwd(), process.env.GITHUB_PRIVATE_KEY_PATH);
        if (fs.existsSync(keyPath)) {
          rawPrivateKey = fs.readFileSync(keyPath, 'utf8');
        }
      } catch (err) {
        console.error('Failed to read private key file:', err);
      }
    }

    // Detect if we are in local development mock-mode
    const isMockMode = !appId || !rawPrivateKey || appId === '123456';
    let repoUrl = '';
    const repoCreatedAt = new Date();

    if (isMockMode) {
      repoUrl = `https://github.com/${competition.org_login}/${repoName}`;
      console.log(`[MOCK PROVISIONING] Mocking repository creation for ${repoName}: ${repoUrl}`);
    } else {
      // Live GitHub API repository creation and collaborator invitation
      try {
        const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
        const app = new App({
          appId,
          privateKey
        });

        const octokit = await app.getInstallationOctokit(parseInt(competition.installation_id, 10));

        // Generate repository from template
        console.log(`[LIVE PROVISIONING] Duplicating template ${parsedTemplate.owner}/${parsedTemplate.repo} into ${competition.org_login}/${repoName}`);
        const genRes = await octokit.request('POST /repos/{template_owner}/{template_repo}/generate', {
          template_owner: parsedTemplate.owner,
          template_repo: parsedTemplate.repo,
          owner: competition.org_login,
          name: repoName,
          private: true
        });
        repoUrl = genRes.data.html_url;

        // Invite candidate as collaborator
        console.log(`[LIVE PROVISIONING] Inviting candidate ${githubUsername} as collaborator on ${repoName}`);
        await octokit.request('PUT /repos/{owner}/{repo}/collaborators/{username}', {
          owner: competition.org_login,
          repo: repoName,
          username: githubUsername,
          permission: 'push'
        });
      } catch (gitErr) {
        console.error('GitHub API repository provisioning error:', gitErr);
        await dbClient.query('ROLLBACK');
        return NextResponse.json({
          error: `GitHub Provisioning Failed: ${gitErr.message || 'Failed to generate repository or invite collaborator'}`
        }, { status: 400 });
      }
    }

    // 4. Save enrollment row
    await dbClient.query(
      'INSERT INTO competition_enrollments (competition_id, user_id, repo_url, repo_created_at) VALUES ($1, $2, $3, $4)',
      [competitionId, user.userId, repoUrl, repoCreatedAt]
    );

    // Commit database transaction
    await dbClient.query('COMMIT');

    // 5. Audit Logging
    await logAudit({
      action: 'ENROLL_COMPETITION',
      performedBy: user.userId,
      targetType: 'Competition',
      targetId: competition.id,
      details: `Candidate: ${user.email} enrolled in Competition: "${competition.title}"`
    });

    await logAudit({
      action: 'REPO_PROVISIONED',
      performedBy: user.userId,
      targetType: 'Competition',
      targetId: competition.id,
      details: `Automated repository provisioned for candidate ${user.email} at ${repoUrl}`
    });

    return NextResponse.json({ message: 'Enrolled successfully!', repoUrl }, { status: 200 });
  } catch (err) {
    await dbClient.query('ROLLBACK');
    console.error('Enroll API Exception:', err);
    return NextResponse.json({ error: err.message || 'Failed to enroll in competition' }, { status: 500 });
  } finally {
    dbClient.release();
  }
}
