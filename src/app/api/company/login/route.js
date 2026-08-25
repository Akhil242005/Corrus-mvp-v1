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

    // Ensure role is company user
    if (!['company_admin', 'company_employee'].includes(user.role)) {
      return NextResponse.json({ error: 'Access denied: Account is not a registered company member' }, { status: 403 });
    }

    if (!user.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
    }

    // Verify employee status if relevant
    if (user.role === 'company_employee' && !user.is_approved) {
      return NextResponse.json({ error: 'Your employee account is pending approval by company admin.' }, { status: 403 });
    }

    // Check if password reset is required (applies to company_employee only)
    if (user.role === 'company_employee' && user.must_reset_password) {
      const resetToken = jwt.sign(
        { 
          userId: user.id.toString(), 
          email: user.email, 
          firstname: user.firstname, 
          role: user.role,
          companyId: user.company_id ? user.company_id.toString() : null,
          passwordResetRequired: true
        },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      return NextResponse.json({ 
        message: 'Password reset required', 
        token: resetToken, 
        passwordResetRequired: true 
      }, { status: 200 });
    }

    const token = jwt.sign(
      { 
        userId: user.id.toString(), 
        email: user.email, 
        firstname: user.firstname, 
        role: user.role,
        companyId: user.company_id ? user.company_id.toString() : null 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    await logAudit({
      action: 'LOGIN_COMPANY',
      performedBy: user.id,
      targetType: 'User',
      targetId: user.id,
      details: `Company user logged in: ${user.email}`
    });

    return NextResponse.json({ message: 'Company login successful', token }, { status: 200 });
  } catch (err) {
    console.error('Company Login API Error:', err);
    return NextResponse.json({ error: 'Server error during company login' }, { status: 500 });
  }
}
