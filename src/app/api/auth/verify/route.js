import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authenticateToken } from '@/lib/auth';

export async function GET(req) {
  try {
    const user = await authenticateToken(req);

    const userRes = await pool.query(
      'SELECT id, firstname, lastname, email, role, company_id FROM users WHERE id = $1 AND is_deleted = false',
      [user.userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const dbUser = userRes.rows[0];

    // Format fields to match current API structure: rename company_id to companyId
    const formattedUser = {
      _id: dbUser.id.toString(),
      id: dbUser.id,
      firstname: dbUser.firstname,
      lastname: dbUser.lastname,
      email: dbUser.email,
      role: dbUser.role,
      companyId: dbUser.company_id
    };

    return NextResponse.json({ valid: true, user: formattedUser }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Invalid token session' }, { status: 401 });
  }
}
