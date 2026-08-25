import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { getCanonicalId } from '@/lib/idMapper';

export async function GET(req) {
  try {
    const user = await requireRole(req, ['company_admin', 'company_employee']);
    const companyId = user.company_id;

    if (!companyId) {
      return NextResponse.json({ error: 'Company association not found' }, { status: 403 });
    }

    const query = `
      SELECT s.id, s.competition_id, s.user_id, s.repo_url, s.evaluation_id, s.status, 
             s.final_score, s.band, s.confidence, s.reasons, s.attributes, s.error_message, s.created_at,
             c.title AS challenge_title, u.firstname, u.lastname, u.email
      FROM submissions s
      INNER JOIN competitions c ON s.competition_id = c.id
      INNER JOIN users u ON s.user_id = u.id
      WHERE c.company_id = $1 AND s.is_deleted = false AND c.is_deleted = false
      ORDER BY s.created_at DESC
    `;

    const res = await pool.query(query, [companyId]);

    const submissions = res.rows.map(row => ({
      _id: getCanonicalId('submission', row.id),
      id: row.id,
      competitionId: row.competition_id,
      challengeTitle: row.challenge_title,
      candidateId: row.user_id,
      candidateName: `${row.firstname} ${row.lastname}`,
      candidateEmail: row.email,
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
    console.error('GET /api/company/submissions exception:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch company submissions' }, { status: 500 });
  }
}
