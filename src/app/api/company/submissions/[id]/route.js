import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { getCanonicalId } from '@/lib/idMapper';
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

export async function GET(req, { params }) {
  try {
    const user = await requireRole(req, ['company_admin', 'company_employee']);
    const companyId = user.company_id;
    const { id: idParam } = await params;

    if (!companyId) {
      return NextResponse.json({ error: 'Company association not found' }, { status: 403 });
    }

    let submission = null;
    let submissionId = parseInt(idParam, 10);

    if (isNaN(submissionId)) {
      // Look up by matching getCanonicalId('submission', id)
      const allSubs = await pool.query(
        `SELECT s.id, s.competition_id, s.user_id, s.repo_url, s.evaluation_id, s.status, 
                s.final_score, s.band, s.confidence, s.reasons, s.attributes, s.error_message, s.created_at,
                c.title AS challenge_title, u.firstname, u.lastname, u.email, i.installation_id
         FROM submissions s
         INNER JOIN competitions c ON s.competition_id = c.id
         INNER JOIN users u ON s.user_id = u.id
         LEFT JOIN installations i ON c.company_id = i.company_id AND i.is_deleted = false
         WHERE c.company_id = $1 AND s.is_deleted = false AND c.is_deleted = false`,
        [companyId]
      );
      submission = allSubs.rows.find(row => getCanonicalId('submission', row.id) === idParam);
    } else {
      const subRes = await pool.query(
        `SELECT s.id, s.competition_id, s.user_id, s.repo_url, s.evaluation_id, s.status, 
                s.final_score, s.band, s.confidence, s.reasons, s.attributes, s.error_message, s.created_at,
                c.title AS challenge_title, u.firstname, u.lastname, u.email, i.installation_id
         FROM submissions s
         INNER JOIN competitions c ON s.competition_id = c.id
         INNER JOIN users u ON s.user_id = u.id
         LEFT JOIN installations i ON c.company_id = i.company_id AND i.is_deleted = false
         WHERE s.id = $1 AND c.company_id = $2 AND s.is_deleted = false AND c.is_deleted = false`,
        [submissionId, companyId]
      );
      if (subRes.rows.length > 0) {
        submission = subRes.rows[0];
      }
    }

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found or access denied' }, { status: 404 });
    }

    // Fetch candidate code files from GitHub dynamically if available
    let codeFiles = [];
    if (submission.repo_url && submission.installation_id) {
      try {
        const appId = process.env.GITHUB_APP_ID;
        let rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY || process.env.GITHUB_PRIVATE_KEY;
        if (!rawPrivateKey && process.env.GITHUB_PRIVATE_KEY_PATH) {
          const keyPath = path.resolve(process.cwd(), process.env.GITHUB_PRIVATE_KEY_PATH);
          if (fs.existsSync(keyPath)) {
            rawPrivateKey = fs.readFileSync(keyPath, 'utf8');
          }
        }
        if (appId && rawPrivateKey) {
          const privateKey = rawPrivateKey.replace(/\\n/g, '\n');
          const app = new App({ appId, privateKey });
          const octokit = await app.getInstallationOctokit(parseInt(submission.installation_id, 10));

          const repoParts = parseRepoUrl(submission.repo_url);
          if (repoParts) {
            const { owner, repo } = repoParts;
            const contentsRes = await octokit.request('GET /repos/{owner}/{repo}/contents', { owner, repo });

            // Look for candidate coding solution files, avoiding config, template, package files
            const sourceFiles = contentsRes.data.filter(item => 
              item.type === 'file' && 
              /\.(js|ts|py|cpp|h|jsx|tsx)$/i.test(item.name) &&
              !/package|webpack|tailwind|next|config|postcss/i.test(item.name)
            );

            for (const file of sourceFiles.slice(0, 3)) { // fetch up to 3 source files
              const fileRes = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                owner,
                repo,
                path: file.path
              });
              if (fileRes.data && fileRes.data.content) {
                const textContent = Buffer.from(fileRes.data.content, 'base64').toString('utf8');
                codeFiles.push({
                  name: file.name,
                  path: file.path,
                  content: textContent
                });
              }
            }
          }
        }
      } catch (gitErr) {
        console.error('Failed to retrieve solution code files from GitHub:', gitErr);
      }
    }

    const result = {
      _id: getCanonicalId('submission', submission.id),
      id: submission.id,
      competitionId: submission.competition_id,
      challengeTitle: submission.challenge_title,
      candidateId: submission.user_id,
      candidateName: `${submission.firstname} ${submission.lastname}`,
      candidateEmail: submission.email,
      repoUrl: submission.repo_url,
      status: submission.status,
      score: submission.final_score,
      band: submission.band,
      confidence: submission.confidence,
      reasons: submission.reasons || [],
      attributes: submission.attributes || {},
      errorMessage: submission.error_message || '',
      submittedAt: submission.created_at.toISOString(),
      codeFiles
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('GET /api/company/submissions/[id] exception:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch submission details' }, { status: 500 });
  }
}
