import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

export async function DELETE(req, { params }) {
  try {
    const admin = await requireRole(req, ['admin']);
    const { id: targetIdStr } = await params;
    const targetId = parseInt(targetIdStr, 10);

    if (isNaN(targetId)) {
      return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
    }

    const compRes = await pool.query('SELECT title FROM competitions WHERE id = $1 AND is_deleted = false', [targetId]);
    if (compRes.rows.length === 0) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 });
    }

    const competition = compRes.rows[0];

    await pool.query(
      'UPDATE competitions SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [targetId]
    );

    await logAudit({
      action: 'DELETE_COMPETITION',
      performedBy: admin.id,
      targetType: 'Competition',
      targetId,
      details: `Admin deleted competition "${competition.title}"`
    });

    return NextResponse.json({ message: 'Competition deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('Delete Competition API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete competition' }, { status: 500 });
  }
}
