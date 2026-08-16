import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth';

export async function GET(req) {
  try {
    const dbUser = await requireRole(req, ['company_admin', 'company_employee']);
    const companyId = dbUser.company_id;

    if (!companyId) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Fetch company details
    const compRes = await pool.query(
      `SELECT c.id, c.name, c.place, c.description, c.website, c.is_verified as "isVerified", 
              u.firstname as "adminFirst", u.lastname as "adminLast", u.email as "adminEmail"
       FROM companies c
       LEFT JOIN users u ON c.admin_id = u.id
       WHERE c.id = $1 AND c.is_deleted = false`,
      [companyId]
    );

    if (compRes.rows.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const companyData = compRes.rows[0];
    const company = {
      _id: companyData.id.toString(),
      id: companyData.id,
      name: companyData.name,
      place: companyData.place,
      description: companyData.description || '',
      website: companyData.website || '',
      isVerified: companyData.isVerified,
      adminId: {
        firstname: companyData.adminFirst || '',
        lastname: companyData.adminLast || '',
        email: companyData.adminEmail || ''
      }
    };

    // Fetch company employees list
    const empRes = await pool.query(
      `SELECT id, firstname, lastname, email, phone, is_approved as "isApproved", created_at as "createdAt" 
       FROM users 
       WHERE company_id = $1 AND role = 'company_employee' AND is_deleted = false
       ORDER BY created_at DESC`,
      [companyId]
    );
    const employees = empRes.rows.map(e => ({
      _id: e.id.toString(),
      id: e.id,
      firstname: e.firstname,
      lastname: e.lastname,
      email: e.email,
      phone: e.phone || '',
      isApproved: e.isApproved,
      createdAt: e.createdAt
    }));

    // Fetch competitions list
    const compsRes = await pool.query(
      `SELECT c.id, c.title, c.task_description as "taskDescription", c.skills_required as "skillsRequired", 
              c.experience_required as "experienceRequired", c.other_requirements as "otherRequirements", c.created_at as "createdAt",
              u.firstname as "creatorFirst", u.lastname as "creatorLast"
       FROM competitions c
       INNER JOIN users u ON c.created_by = u.id
       WHERE c.company_id = $1 AND c.is_deleted = false
       ORDER BY c.created_at DESC`,
      [companyId]
    );
    const competitions = compsRes.rows.map(c => ({
      _id: c.id.toString(),
      id: c.id,
      title: c.title,
      taskDescription: c.taskDescription,
      skillsRequired: c.skillsRequired || [],
      experienceRequired: c.experienceRequired,
      otherRequirements: c.otherRequirements || '',
      createdAt: c.createdAt,
      createdBy: {
        firstname: c.creatorFirst,
        lastname: c.creatorLast
      }
    }));

    return NextResponse.json({
      company,
      currentUserRole: dbUser.role,
      employees,
      competitions
    }, { status: 200 });
  } catch (err) {
    console.error('Company Dashboard API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch company dashboard data' }, { status: 500 });
  }
}
