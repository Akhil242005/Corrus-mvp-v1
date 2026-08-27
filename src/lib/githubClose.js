import pool from './db';
import { logAudit } from './auth';
import { App } from '@octokit/app';
import fs from 'fs';
import path from 'path';

function parseRepoUrl(url) {
  if (!url) return null;
  const cleanStr = url.trim().replace(/\.git$/, '');
  const urlParts = cleanStr.split('/');
  if (urlParts.length >= 2) {
    const repo = urlParts[urlParts.length - 1];
    const owner = urlParts[urlParts.length - 2].split(':').pop(); // Handle git@github.com:owner
    return { owner, repo };
  }
  return null;
}

export async function closeCompetitionSubmissions(competitionId, performedByUserId = null) {
  // 1. Fetch competition and company installation row
  const compRes = await pool.query(
    `SELECT c.id, c.title, c.closed_at, i.installation_id 
     FROM competitions c
     LEFT JOIN installations i ON c.company_id = i.company_id AND i.is_deleted = false
     WHERE c.id = $1 AND c.is_deleted = false`,
    [competitionId]
  );

  if (compRes.rows.length === 0) {
    throw new Error('Competition not found');
  }

  const competition = compRes.rows[0];

  if (competition.closed_at) {
    return { alreadyClosed: true, title: competition.title };
  }

  // 2. Fetch all candidates enrolled with a setup repository
  const enrollRes = await pool.query(
    `SELECT ce.user_id, ce.repo_url, u.github_username 
     FROM competition_enrollments ce
     INNER JOIN users u ON ce.user_id = u.id
     WHERE ce.competition_id = $1 AND ce.repo_url IS NOT NULL`,
    [competitionId]
  );

  const enrollments = enrollRes.rows;
  let successCount = 0;
  let failCount = 0;

  if (enrollments.length > 0 && competition.installation_id) {
    const appId = process.env.GITHUB_APP_ID;
    let rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY;
    if (!rawPrivateKey && process.env.GITHUB_PRIVATE_KEY_PATH) {
      try {
        const keyPath = path.resolve(process.cwd(), process.env.GITHUB_PRIVATE_KEY_PATH);
        if (fs.existsSync(keyPath)) {
          rawPrivateKey = fs.readFileSync(keyPath, 'utf8');
        }
      } catch (err) {
        console.error('[CLOSE-SUBMISSIONS-UTIL] Failed to load key:', err);
      }
    }

    if (appId && rawPrivateKey) {
      try {
        const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
        const app = new App({ appId, privateKey });
        const octokit = await app.getInstallationOctokit(parseInt(competition.installation_id, 10));

        // Loop over enrollments and downgrade permissions to 'pull'
        for (const row of enrollments) {
          const repoParts = parseRepoUrl(row.repo_url);
          if (!repoParts || !row.github_username) {
            failCount++;
            continue;
          }
          const { owner, repo } = repoParts;
          try {
            console.log(`[CLOSE-SUBMISSIONS-UTIL] Downgrading collaborator ${row.github_username} to 'pull' on ${owner}/${repo}`);
            await octokit.request('PUT /repos/{owner}/{repo}/collaborators/{username}', {
              owner,
              repo,
              username: row.github_username,
              permission: 'pull'
            });
            successCount++;
          } catch (gitErr) {
            console.error(`[CLOSE-SUBMISSIONS-UTIL] Failed to downgrade candidate ${row.github_username} on repo ${row.repo_url}:`, gitErr);
            failCount++;
          }
        }
      } catch (appErr) {
        console.error('[CLOSE-SUBMISSIONS-UTIL] Failed to initialize Octokit App:', appErr);
        throw new Error('Failed to authenticate with GitHub App');
      }
    } else {
      console.error('[CLOSE-SUBMISSIONS-UTIL] GitHub App credentials not set on server.');
    }
  }

  // 3. Mark competition as closed in DB
  await pool.query(
    'UPDATE competitions SET closed_at = CURRENT_TIMESTAMP WHERE id = $1',
    [competitionId]
  );

  // 4. Log audit action
  await logAudit({
    action: 'SUBMISSIONS_CLOSED',
    performedBy: performedByUserId, // null indicates system-triggered
    targetType: 'Competition',
    targetId: competitionId,
    changes: {
      successCount,
      failCount,
      totalCount: enrollments.length,
      systemTriggered: !performedByUserId
    },
    details: `${performedByUserId ? 'Manual' : 'System automated'} submissions closed for competition "${competition.title}". Downgraded push privileges (Success: ${successCount}, Failed: ${failCount}).`
  });

  return {
    alreadyClosed: false,
    title: competition.title,
    successCount,
    failCount
  };
}
