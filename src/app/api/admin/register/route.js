import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';

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
    const { firstname, lastname, email, phone, password, securityKey } = await req.json();
    const expectedKey = process.env.ADMIN_SECURITY_KEY || 'corruss_admin_secret_99';

    if (!securityKey || securityKey !== expectedKey) {
      return NextResponse.json({ error: 'Invalid Admin Security Key' }, { status: 403 });
    }

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

    // Check if user already exists
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND is_deleted = false', [trimmedEmail]);
    if (emailCheck.rows.length > 0) {
      return NextResponse.json({ error: 'User already exists with this email' }, { status: 400 });
    }

    // Check if phone number is already registered
    if (trimmedPhone) {
      const phoneCheck = await pool.query('SELECT id FROM users WHERE phone = $1 AND is_deleted = false', [trimmedPhone]);
      if (phoneCheck.rows.length > 0) {
        return NextResponse.json({ error: 'Phone number is already registered' }, { status: 400 });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertRes = await pool.query(
      `INSERT INTO users (firstname, lastname, email, phone, password, role) 
       VALUES ($1, $2, $3, $4, $5, 'admin') 
       RETURNING id, firstname, email, role`,
      [firstname, lastname || '', trimmedEmail, trimmedPhone, hashedPassword]
    );

    const newAdmin = insertRes.rows[0];

    const token = jwt.sign(
      { userId: newAdmin.id.toString(), email: newAdmin.email, firstname: newAdmin.firstname, role: newAdmin.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return NextResponse.json({ message: 'Admin registered successfully!', token }, { status: 201 });
  } catch (err) {
    console.error('Admin Register API Error:', err);
    return NextResponse.json({ error: 'Server error during admin registration' }, { status: 500 });
  }
}
