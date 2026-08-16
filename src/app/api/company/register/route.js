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
  const client = await pool.connect();
  try {
    const { companyName, place, description, website, firstname, lastname, email, phone, password } = await req.json();

    if (!companyName || !place || !firstname || !email || !password) {
      return NextResponse.json({ error: 'Company Name, Place, Admin First Name, Email, and Password are required' }, { status: 400 });
    }

    if (!validateEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }
    if (!validatePhone(phone)) {
      return NextResponse.json({ error: 'Phone number must be exactly 10 digits' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone ? phone.trim() : null;

    // Check if email already registered
    const emailCheck = await client.query('SELECT id FROM users WHERE email = $1 AND is_deleted = false', [trimmedEmail]);
    if (emailCheck.rows.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }

    // Check if phone number is already registered
    if (trimmedPhone) {
      const phoneCheck = await client.query('SELECT id FROM users WHERE phone = $1 AND is_deleted = false', [trimmedPhone]);
      if (phoneCheck.rows.length > 0) {
        return NextResponse.json({ error: 'Phone number is already registered' }, { status: 400 });
      }
    }

    // Check if company name is already registered
    const companyCheck = await client.query('SELECT id FROM companies WHERE name = $1 AND is_deleted = false', [companyName]);
    if (companyCheck.rows.length > 0) {
      return NextResponse.json({ error: 'Company name is already registered' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Start Transaction
    await client.query('BEGIN');

    // 1. Insert new admin user (temporarily without companyId)
    const userRes = await client.query(
      `INSERT INTO users (firstname, lastname, email, phone, password, role) 
       VALUES ($1, $2, $3, $4, $5, 'company_admin') 
       RETURNING id, firstname, email, role`,
      [firstname, lastname || '', trimmedEmail, trimmedPhone, hashedPassword]
    );
    const newAdmin = userRes.rows[0];

    // 2. Insert new company
    const companyRes = await client.query(
      `INSERT INTO companies (name, place, description, website, admin_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name`,
      [companyName, place, description || '', website || '', newAdmin.id]
    );
    const newCompany = companyRes.rows[0];

    // 3. Link admin user to companyId
    await client.query(
      'UPDATE users SET company_id = $1 WHERE id = $2',
      [newCompany.id, newAdmin.id]
    );

    // Commit Transaction
    await client.query('COMMIT');

    await logAudit({
      action: 'REGISTER_COMPANY',
      performedBy: newAdmin.id,
      targetType: 'Company',
      targetId: newCompany.id,
      details: `New company registered: ${newCompany.name} (${newAdmin.email})`
    });

    const token = jwt.sign(
      { userId: newAdmin.id.toString(), email: newAdmin.email, firstname: newAdmin.firstname, role: newAdmin.role, companyId: newCompany.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    return NextResponse.json({ message: 'Company registered successfully!', token }, { status: 201 });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Company Registration API Error:', err);
    return NextResponse.json({ error: 'Failed to register company' }, { status: 500 });
  } finally {
    client.release();
  }
}
