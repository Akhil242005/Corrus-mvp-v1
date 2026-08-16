import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authenticateToken, logAudit } from '@/lib/auth';

export async function POST(req, { params }) {
  try {
    const user = await authenticateToken(req);
    const { id: competitionIdStr } = await params;
    const competitionId = parseInt(competitionIdStr, 10);

    if (isNaN(competitionId)) {
      return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
    }

    // Verify competition exists
    const compRes = await pool.query('SELECT id, title FROM competitions WHERE id = $1 AND is_deleted = false', [competitionId]);
    if (compRes.rows.length === 0) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }
    const competition = compRes.rows[0];

    // Check if already enrolled
    const enrollRes = await pool.query(
      'SELECT 1 FROM competition_enrollments WHERE competition_id = $1 AND user_id = $2',
      [competitionId, user.userId]
    );

    if (enrollRes.rows.length > 0) {
      return NextResponse.json({ error: 'You are already enrolled in this competition.' }, { status: 400 });
    }

    // Insert enrollment
    await pool.query(
      'INSERT INTO competition_enrollments (competition_id, user_id) VALUES ($1, $2)',
      [competitionId, user.userId]
    );

    await logAudit({
      action: 'ENROLL_COMPETITION',
      performedBy: user.userId,
      targetType: 'Competition',
      targetId: competition.id,
      details: `Candidate: ${user.email} enrolled in Competition: "${competition.title}"`
    });

    return NextResponse.json({ message: 'Enrolled successfully!' }, { status: 200 });
  } catch (err) {
    console.error('Enroll API Exception:', err);
    return NextResponse.json({ error: err.message || 'Failed to enroll in competition' }, { status: 500 });
  }
}
