import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

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
    const admin = await requireRole(req, ['company_admin']);
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

    // Check if user already exists
    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1 AND is_deleted = false', [trimmedEmail]);
    if (emailCheck.rows.length > 0) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
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
      `INSERT INTO users (firstname, lastname, email, phone, password, role, company_id, is_approved) 
       VALUES ($1, $2, $3, $4, $5, 'company_employee', $6, true) 
       RETURNING id, firstname, lastname, email, phone, role, company_id, is_approved, created_at`,
      [firstname, lastname || '', trimmedEmail, trimmedPhone, hashedPassword, admin.company_id]
    );

    const newEmployee = insertRes.rows[0];

    await logAudit({
      action: 'ADD_EMPLOYEE',
      performedBy: admin.id,
      targetType: 'User',
      targetId: newEmployee.id,
      details: `Employee ${newEmployee.email} added to company by ${admin.email}`
    });

    const formattedEmployee = {
      _id: newEmployee.id.toString(),
      id: newEmployee.id,
      firstname: newEmployee.firstname,
      lastname: newEmployee.lastname,
      email: newEmployee.email,
      phone: newEmployee.phone || '',
      isApproved: newEmployee.is_approved,
      createdAt: newEmployee.created_at
    };

    return NextResponse.json({ message: 'Employee added successfully', employee: formattedEmployee }, { status: 201 });
  } catch (err) {
    console.error('Add Employee API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create employee account' }, { status: 500 });
  }
}
