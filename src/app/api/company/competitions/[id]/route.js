import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

export async function DELETE(req, { params }) {
  try {
    const user = await requireRole(req, ['company_admin', 'company_employee']);
    const { id: competitionIdStr } = await params;
    const competitionId = parseInt(competitionIdStr, 10);

    if (isNaN(competitionId)) {
      return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
    }

    const companyId = user.company_id;

    const deleteRes = await pool.query(
      `UPDATE competitions 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND company_id = $2 AND is_deleted = false 
       RETURNING id, title`,
      [competitionId, companyId]
    );

    if (deleteRes.rows.length === 0) {
      return NextResponse.json({ error: 'Competition not found or unauthorized.' }, { status: 404 });
    }

    const competition = deleteRes.rows[0];

    await logAudit({
      action: 'DELETE_COMPETITION',
      performedBy: user.id,
      targetType: 'Competition',
      targetId: competition.id,
      details: `Company user deleted competition: ${competition.title}`
    });

    return NextResponse.json({ message: 'Competition soft-deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('Delete Company Competition API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete company competition' }, { status: 500 });
  }
}
