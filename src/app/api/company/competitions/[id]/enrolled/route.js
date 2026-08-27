import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req, { params }) {
  try {
    const user = await requireRole(req, ['company_admin', 'company_employee']);
    const { id: competitionIdStr } = await params;
    const competitionId = parseInt(competitionIdStr, 10);

    if (isNaN(competitionId)) {
      return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
    }

    const companyId = user.company_id;

    // Check if competition exists under company
    const compCheck = await pool.query(
      'SELECT id, title FROM competitions WHERE id = $1 AND company_id = $2 AND is_deleted = false',
      [competitionId, companyId]
    );

    if (compCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    const competition = compCheck.rows[0];

    // Fetch enrolled users list
    const rosterRes = await pool.query(
      `SELECT u.id, u.firstname, u.lastname, u.email, u.phone, ce.repo_url as "repoUrl", ce.created_at as "createdAt"
       FROM users u
       INNER JOIN competition_enrollments ce ON u.id = ce.user_id
       WHERE ce.competition_id = $1 AND u.is_deleted = false
       ORDER BY ce.created_at DESC`,
      [competitionId]
    );

    const enrolledUsers = rosterRes.rows.map(e => ({
      _id: e.id.toString(),
      id: e.id,
      firstname: e.firstname,
      lastname: e.lastname,
      email: e.email,
      phone: e.phone || '',
      repoUrl: e.repoUrl || null,
      createdAt: e.createdAt
    }));

    return NextResponse.json({ competitionTitle: competition.title, enrolledUsers }, { status: 200 });
  } catch (err) {
    console.error('Enrolled Candidates API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch candidate roster' }, { status: 500 });
  }
}
