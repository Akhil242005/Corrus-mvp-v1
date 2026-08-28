import { NextResponse } from 'next/server';
import crypto from 'crypto';
import pool from '@/lib/db';
import { logAudit } from '@/lib/auth';

function verifySignature(body, signature, secret) {
  if (!signature || !secret) return false;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch (e) {
    return false;
  }
}

export async function POST(req) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!verifySignature(rawBody, signature, secret)) {
      return NextResponse.json({ error: 'Invalid or missing signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const event = req.headers.get('x-github-event');

    if (event === 'installation') {
      const action = payload.action;
      const installationId = payload.installation?.id;
      const orgLogin = payload.installation?.account?.login;

      if (!installationId || !orgLogin) {
        return NextResponse.json({ error: 'Malformed installation payload' }, { status: 400 });
      }

      if (action === 'created') {
        // Resolve company ID
        let companyId = null;
        if (payload.sender) {
          const userRes = await pool.query(
            'SELECT company_id FROM users WHERE github_id = $1 AND is_deleted = false',
            [String(payload.sender.id)]
          );
          if (userRes.rows.length > 0) {
            companyId = userRes.rows[0].company_id;
          }
        }
        if (!companyId) {
          const compRes = await pool.query(
            'SELECT id FROM companies WHERE LOWER(name) = LOWER($1) AND is_deleted = false',
            [orgLogin]
          );
          if (compRes.rows.length > 0) {
            companyId = compRes.rows[0].id;
          }
        }

        // Upsert installation record
        await pool.query(
          `INSERT INTO installations (company_id, org_login, installation_id, is_deleted, deleted_at)
           VALUES ($1, $2, $3, false, null)
           ON CONFLICT (installation_id)
           DO UPDATE SET company_id = $1, org_login = $2, is_deleted = false, deleted_at = null, installed_at = CURRENT_TIMESTAMP`,
          [companyId, orgLogin, installationId]
        );

        await logAudit({
          action: 'INSTALLATION_CONNECTED',
          performedBy: null,
          targetType: 'Company',
          targetId: companyId,
          details: `GitHub App installed for organization "${orgLogin}" (Installation ID: ${installationId})`
        });

      } else if (action === 'deleted' || action === 'suspend') {
        const instRes = await pool.query(
          'SELECT company_id, org_login FROM installations WHERE installation_id = $1',
          [installationId]
        );
        const companyId = instRes.rows[0]?.company_id || null;

        await pool.query(
          'UPDATE installations SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE installation_id = $1',
          [installationId]
        );

        await logAudit({
          action: 'INSTALLATION_REMOVED',
          performedBy: null,
          targetType: 'Company',
          targetId: companyId,
          details: `GitHub App uninstalled/suspended for organization "${orgLogin}" (Installation ID: ${installationId})`
        });
      }

      return NextResponse.json({ message: 'Installation webhook processed successfully' }, { status: 200 });
    }

    if (event === 'push') {
      const installationId = payload.installation?.id;
      const cloneUrl = payload.repository?.clone_url;
      const repoName = payload.repository?.name;

      if (!installationId || !cloneUrl || !repoName) {
        return NextResponse.json({ error: 'Missing repository or installation details' }, { status: 400 });
      }

      // 1. Resolve company ID from active installations
      const instRes = await pool.query(
        'SELECT company_id FROM installations WHERE installation_id = $1 AND is_deleted = false',
        [installationId]
      );
      if (instRes.rows.length === 0) {
        return NextResponse.json({ error: 'GitHub App Installation not registered or inactive' }, { status: 404 });
      }
      const companyId = instRes.rows[0].company_id;

      let candidateId = null;
      let competitionId = null;
      let matchedComp = null;

      // Try lookup by repo URL in competition_enrollments
      const cleanUrl = cloneUrl.replace(/\.git$/, '');
      const enrollmentRes = await pool.query(
        `SELECT competition_id, user_id FROM competition_enrollments 
         WHERE repo_url = $1 OR repo_url = $2 OR repo_url LIKE $3`,
        [cloneUrl, cleanUrl, `%/${repoName}`]
      );

      if (enrollmentRes.rows.length > 0) {
        candidateId = enrollmentRes.rows[0].user_id;
        competitionId = enrollmentRes.rows[0].competition_id;
        
        // Fetch competition info
        const compRes = await pool.query(
          'SELECT id, title, language FROM competitions WHERE id = $1 AND is_deleted = false',
          [competitionId]
        );
        matchedComp = compRes.rows[0];
      } else {
        // Fallback to legacy parsing: {competition-slug}-{candidate-id}
        const parts = repoName.split('-');
        if (parts.length >= 2) {
          const parsedCandidateId = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(parsedCandidateId)) {
            candidateId = parsedCandidateId;
            const competitionSlug = parts.slice(0, parts.length - 1).join('-');
            
            const compsRes = await pool.query(
              'SELECT id, title, language FROM competitions WHERE company_id = $1 AND is_deleted = false',
              [companyId]
            );
            const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
            matchedComp = compsRes.rows.find(c => slugify(c.title) === competitionSlug);
            if (matchedComp) {
              competitionId = matchedComp.id;
            }
          }
        }
      }

      if (!candidateId || !competitionId || !matchedComp) {
        return NextResponse.json({ error: 'Could not resolve enrolled candidate and competition for this repository' }, { status: 404 });
      }

      // Verify candidate user exists and is active
      const userRes = await pool.query(
        'SELECT id FROM users WHERE id = $1 AND is_deleted = false',
        [candidateId]
      );
      if (userRes.rows.length === 0) {
        return NextResponse.json({ error: 'Candidate user not found or inactive' }, { status: 404 });
      }

      // 5. Record initial PENDING submission record
      const insertRes = await pool.query(
        `INSERT INTO submissions (competition_id, user_id, repo_url, status)
         VALUES ($1, $2, $3, 'PENDING')
         RETURNING id`,
        [competitionId, candidateId, cloneUrl]
      );
      const submissionId = insertRes.rows[0].id;

      await logAudit({
        action: 'SUBMISSION_RECEIVED',
        performedBy: candidateId,
        targetType: 'Competition',
        targetId: competitionId,
        details: `Submission received for competition "${matchedComp.title}" via GitHub push (Submission ID: ${submissionId})`
      });

      // 6. Request evaluation dispatch to Python Analyzer
      const analyzerUrl = (process.env.ANALYZER_BASE_URL || 'http://localhost:8000').replace(/\/$/, '') + '/api/v1/evaluate';

      const languageImageMap = {
        'Python': 'python:3.11-slim',
        'JavaScript/TypeScript': 'node:20',
        'C++': 'gcc:13'
      };

      const languageTestCommandMap = {
        'Python': 'python3 -m unittest discover',
        'JavaScript/TypeScript': 'npm test',
        'C++': 'make test'
      };

      const dockerImage = languageImageMap[matchedComp.language] || 'python:3.11-slim';
      const testCommand = languageTestCommandMap[matchedComp.language] || 'python3 -m unittest discover';

      try {
        const evaluateResponse = await fetch(analyzerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repo_url: cloneUrl,
            installation_id: installationId,
            test_command: testCommand,
            docker_image: dockerImage
          })
        });

        if (evaluateResponse.ok) {
          const evaluateData = await evaluateResponse.json();
          const evaluationId = evaluateData.evaluation_id;
          const status = evaluateData.status || 'PENDING';

          await pool.query(
            'UPDATE submissions SET evaluation_id = $1, status = $2 WHERE id = $3',
            [evaluationId, status, submissionId]
          );
        } else {
          const errText = await evaluateResponse.text();
          console.error('Analyzer evaluation request failed:', errText);
          await pool.query(
            "UPDATE submissions SET status = 'FAILED', error_message = $1 WHERE id = $2",
            [`Analyzer returned status ${evaluateResponse.status}: ${errText}`, submissionId]
          );
        }
      } catch (err) {
        console.error('Analyzer connection exception:', err);
        await pool.query(
          "UPDATE submissions SET status = 'FAILED', error_message = $1 WHERE id = $2",
          [`Connection error: ${err.message}`, submissionId]
        );
      }

      return NextResponse.json({ message: 'Push webhook processed successfully', submissionId }, { status: 202 });
    }

    return NextResponse.json({ message: 'Event ignored' }, { status: 200 });
  } catch (err) {
    console.error('Webhook Endpoint Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
