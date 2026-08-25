import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authenticateToken } from '@/lib/auth';
import { getCanonicalId } from '@/lib/idMapper';

export async function GET(req) {
  try {
    const user = await authenticateToken(req);

    const query = `
      SELECT s.id, s.competition_id, s.user_id, s.repo_url, s.evaluation_id, s.status, 
             s.final_score, s.band, s.confidence, s.reasons, s.attributes, s.error_message, s.created_at,
             c.title AS challenge_title, comp.name AS company_name
      FROM submissions s
      INNER JOIN competitions c ON s.competition_id = c.id
      INNER JOIN companies comp ON c.company_id = comp.id
      WHERE s.user_id = $1 AND s.is_deleted = false AND c.is_deleted = false
      ORDER BY s.created_at DESC
    `;

    const res = await pool.query(query, [user.userId]);

    const submissions = res.rows.map(row => ({
      _id: getCanonicalId('submission', row.id),
      id: row.id,
      competitionId: row.competition_id,
      challengeTitle: row.challenge_title,
      companyName: row.company_name,
      repoUrl: row.repo_url,
      status: row.status,
      score: row.final_score,
      band: row.band,
      confidence: row.confidence,
      reasons: row.reasons || [],
      attributes: row.attributes || {},
      errorMessage: row.error_message || '',
      submittedAt: row.created_at.toISOString()
    }));

    return NextResponse.json(submissions, { status: 200 });
  } catch (err) {
    console.error('GET /api/submissions exception:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch submissions' }, { status: 500 });
  }
}
