import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

export async function PUT(req, { params }) {
  try {
    const admin = await requireRole(req, ['admin']);
    const { id: targetIdStr } = await params;
    const targetId = parseInt(targetIdStr, 10);

    if (isNaN(targetId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });
    }

    const { role } = await req.json();

    if (!['user', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role parameter' }, { status: 400 });
    }

    const userRes = await pool.query('SELECT role, email FROM users WHERE id = $1 AND is_deleted = false', [targetId]);
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = userRes.rows[0];
    const oldRole = targetUser.role;

    await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, targetId]);

    await logAudit({
      action: 'UPDATE_USER_ROLE',
      performedBy: admin.id,
      targetType: 'User',
      targetId,
      changes: { role: { old: oldRole, new: role } },
      details: `Changed role for user ${targetUser.email} from "${oldRole}" to "${role}"`
    });

    const updatedRes = await pool.query(
      'SELECT id, firstname, lastname, email, role, phone, created_at as "createdAt" FROM users WHERE id = $1',
      [targetId]
    );
    const updatedUser = updatedRes.rows[0];

    const formattedUser = {
      _id: updatedUser.id.toString(),
      id: updatedUser.id,
      firstname: updatedUser.firstname,
      lastname: updatedUser.lastname,
      email: updatedUser.email,
      role: updatedUser.role,
      phone: updatedUser.phone || '',
      createdAt: updatedUser.createdAt
    };

    return NextResponse.json({ message: 'Role updated successfully', user: formattedUser }, { status: 200 });
  } catch (err) {
    console.error('Update Role API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update user role' }, { status: 500 });
  }
}
