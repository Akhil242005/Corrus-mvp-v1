import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

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

    // Ensure role is admin
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Access denied: Account is not registered as an Admin' }, { status: 403 });
    }

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

    return NextResponse.json({ message: 'Admin login successful', token }, { status: 200 });
  } catch (err) {
    console.error('Admin Login API Error:', err);
    return NextResponse.json({ error: 'Server error during admin login' }, { status: 500 });
  }
}
