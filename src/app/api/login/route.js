import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';
import { logAudit } from '@/lib/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email) {
  return email && EMAIL_REGEX.test(String(email).trim().toLowerCase());
}

export async function POST(req) {
  try {
    const { email, password } = await req.json();

    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();

    const userRes = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_deleted = false',
      [trimmedEmail]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
    }

    const user = userRes.rows[0];

    // Local login matches local auth provider password
    if (!user.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
    }

    const token = jwt.sign(
      { userId: user.id.toString(), email: user.email, firstname: user.firstname, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await logAudit({
      action: 'LOGIN_USER',
      performedBy: user.id,
      targetType: 'User',
      targetId: user.id,
      details: `Candidate logged in: ${user.email}`
    });

    return NextResponse.json({ message: 'Login successful', token }, { status: 200 });
  } catch (err) {
    console.error('Login API Error:', err);
    return NextResponse.json({ error: 'Server error during login' }, { status: 500 });
  }
}
