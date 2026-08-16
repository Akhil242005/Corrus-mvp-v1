import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

export async function DELETE(req, { params }) {
  try {
    const admin = await requireRole(req, ['admin']);
    const { id: targetIdStr } = await params;
    const targetId = parseInt(targetIdStr, 10);

    if (isNaN(targetId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    if (targetId === admin.id) {
      return NextResponse.json({ error: 'You cannot delete your own admin account' }, { status: 400 });
    }

    const userRes = await pool.query('SELECT email FROM users WHERE id = $1 AND is_deleted = false', [targetId]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = userRes.rows[0];

    await pool.query(
      'UPDATE users SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [targetId]
    );

    await logAudit({
      action: 'DELETE_USER',
      performedBy: admin.id,
      targetType: 'User',
      targetId,
      details: `Admin soft-deleted user account: ${targetUser.email}`
    });

    return NextResponse.json({ message: 'User soft-deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('Delete User API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete user' }, { status: 500 });
  }
}
