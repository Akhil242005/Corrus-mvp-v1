import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';
import { authenticateToken } from '@/lib/auth';

export async function POST(req) {
  try {
    const user = await authenticateToken(req);
    const { securityKey } = await req.json();

    const expectedKey = process.env.ADMIN_SECURITY_KEY || 'corrus_admin_secret_99';

    if (!securityKey || securityKey !== expectedKey) {
      return NextResponse.json({ error: 'Invalid Admin Security Key' }, { status: 403 });
    }

    const updateRes = await pool.query(
      "UPDATE users SET role = 'admin' WHERE id = $1 AND is_deleted = false RETURNING id, firstname, email, role",
      [user.userId]
    );

    if (updateRes.rows.length === 0) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    const updatedUser = updateRes.rows[0];

    const token = jwt.sign(
      { userId: updatedUser.id.toString(), email: updatedUser.email, firstname: updatedUser.firstname, role: updatedUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return NextResponse.json({ message: 'Account promoted to Admin successfully!', token }, { status: 200 });
  } catch (err) {
    console.error('Make Me Admin API Error:', err);
    return NextResponse.json({ error: 'Failed to update user role on server' }, { status: 500 });
  }
}
