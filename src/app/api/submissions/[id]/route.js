import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authenticateToken } from '@/lib/auth';
import { getCanonicalId } from '@/lib/idMapper';

export async function GET(req, { params }) {
  try {
    const user = await authenticateToken(req);
    const { id: idParam } = await params;

    let submission = null;
    let submissionId = parseInt(idParam, 10);

    if (isNaN(submissionId)) {
      // Look up by matching getCanonicalId('submission', id)
      const allSubs = await pool.query(
        `SELECT s.id, s.competition_id, s.user_id, s.repo_url, s.evaluation_id, s.status, 
                s.final_score, s.band, s.confidence, s.reasons, s.attributes, s.error_message, s.created_at,
                c.title AS challenge_title, comp.name AS company_name
         FROM submissions s
         INNER JOIN competitions c ON s.competition_id = c.id
         INNER JOIN companies comp ON c.company_id = comp.id
         WHERE s.user_id = $1 AND s.is_deleted = false AND c.is_deleted = false`,
        [user.userId]
      );
      submission = allSubs.rows.find(row => getCanonicalId('submission', row.id) === idParam);
    } else {
      const subRes = await pool.query(
        `SELECT s.id, s.competition_id, s.user_id, s.repo_url, s.evaluation_id, s.status, 
                s.final_score, s.band, s.confidence, s.reasons, s.attributes, s.error_message, s.created_at,
                c.title AS challenge_title, comp.name AS company_name
         FROM submissions s
         INNER JOIN competitions c ON s.competition_id = c.id
         INNER JOIN companies comp ON c.company_id = comp.id
         WHERE s.id = $1 AND s.user_id = $2 AND s.is_deleted = false AND c.is_deleted = false`,
        [submissionId, user.userId]
      );
      if (subRes.rows.length > 0) {
        submission = subRes.rows[0];
      }
    }

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found or access denied' }, { status: 404 });
    }

    const result = {
      _id: getCanonicalId('submission', submission.id),
      id: submission.id,
      competitionId: submission.competition_id,
      challengeTitle: submission.challenge_title,
      companyName: submission.company_name,
      repoUrl: submission.repo_url,
      status: submission.status,
      score: submission.final_score,
      band: submission.band,
      confidence: submission.confidence,
      reasons: submission.reasons || [],
      attributes: submission.attributes || {},
      errorMessage: submission.error_message || '',
      submittedAt: submission.created_at.toISOString()
    };

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('GET /api/submissions/[id] exception:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch submission' }, { status: 500 });
  }
}
