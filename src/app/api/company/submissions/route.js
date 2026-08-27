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

    const competitionIdParam = req.nextUrl.searchParams.get('competitionId');
    const formatParam = req.nextUrl.searchParams.get('format');

    let query = `
      SELECT s.id, s.competition_id, s.user_id, s.repo_url, s.evaluation_id, s.status, 
             s.final_score, s.band, s.confidence, s.reasons, s.attributes, s.error_message, s.created_at,
             c.title AS challenge_title, u.firstname, u.lastname, u.email
      FROM submissions s
      INNER JOIN competitions c ON s.competition_id = c.id
      INNER JOIN users u ON s.user_id = u.id
      WHERE c.company_id = $1 AND s.is_deleted = false AND c.is_deleted = false
    `;

    const queryParams = [companyId];

    if (competitionIdParam) {
      query += ` AND s.competition_id = $2`;
      queryParams.push(parseInt(competitionIdParam, 10));
    }

    // Leaderboard ranking sort: score DESC, then earliest submission created_at ASC
    query += ` ORDER BY s.final_score DESC NULLS LAST, s.created_at ASC`;

    const res = await pool.query(query, queryParams);

    const submissions = res.rows.map((row, idx) => ({
      rank: idx + 1,
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

    if (formatParam === 'csv') {
      const headers = ['Rank', 'Submission ID', 'Candidate ID', 'Candidate Name', 'Email Address', 'Score (%)', 'Band', 'Confidence', 'Submitted At', 'GitHub Repository'];
      const csvRows = [headers.join(',')];

      submissions.forEach(sub => {
        const row = [
          sub.rank,
          sub._id,
          getCanonicalId('candidate', sub.candidateId),
          `"${sub.candidateName.replace(/"/g, '""')}"`,
          `"${sub.candidateEmail.replace(/"/g, '""')}"`,
          sub.score !== null ? sub.score : 'N/A',
          sub.band || 'N/A',
          sub.confidence !== null ? sub.confidence : 'N/A',
          sub.submittedAt,
          sub.repoUrl || 'N/A'
        ];
        csvRows.push(row.join(','));
      });

      const csvString = csvRows.join('\n');

      return new NextResponse(csvString, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="submissions_competition_${competitionIdParam || 'all'}.csv"`
        }
      });
    }

    return NextResponse.json(submissions, { status: 200 });
  } catch (err) {
    console.error('GET /api/company/submissions exception:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch company submissions' }, { status: 500 });
  }
}
