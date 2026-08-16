import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';
import { logAudit } from '@/lib/auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9]{10}$/;

function validateEmail(email) {
  return email && EMAIL_REGEX.test(String(email).trim().toLowerCase());
}

function validatePhone(phone) {
  if (!phone || String(phone).trim() === '') return true;
  return PHONE_REGEX.test(String(phone).trim());
}

export async function POST(req) {
  try {
    const { firstname, lastname, email, phone, password } = await req.json();

    if (!firstname || !email || !password) {
      return NextResponse.json({ error: 'First name, email, and password are required' }, { status: 400 });
    }
    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }
    if (!validatePhone(phone)) {
      return NextResponse.json({ error: 'Phone number must be exactly 10 digits' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone ? phone.trim() : null;

    // Check if user email already exists
    const emailCheck = await pool.query(
      'SELECT id FROM users WHERE email = $1 AND is_deleted = false',
      [trimmedEmail]
    );
    if (emailCheck.rows.length > 0) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Check if phone number is already registered
    if (trimmedPhone) {
      const phoneCheck = await pool.query(
        'SELECT id FROM users WHERE phone = $1 AND is_deleted = false',
        [trimmedPhone]
      );
      if (phoneCheck.rows.length > 0) {
        return NextResponse.json({ error: 'Phone number is already registered' }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertRes = await pool.query(
      `INSERT INTO users (firstname, lastname, email, phone, password) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, firstname, email, role`,
      [firstname, lastname || '', trimmedEmail, trimmedPhone, hashedPassword]
    );

    const newUser = insertRes.rows[0];

    // Log the user registration audit log
    await logAudit({
      action: 'REGISTER_USER',
      performedBy: newUser.id,
      targetType: 'User',
      targetId: newUser.id,
      details: `New candidate registered: ${newUser.email}`
    });

    const token = jwt.sign(
      { userId: newUser.id.toString(), email: newUser.email, firstname: newUser.firstname, role: newUser.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return NextResponse.json({ message: 'User registered successfully!', token }, { status: 201 });
  } catch (err) {
    console.error('Registration API Error:', err);
    return NextResponse.json({ error: 'Server error during registration' }, { status: 500 });
  }
}
