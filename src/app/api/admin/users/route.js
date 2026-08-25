import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth';

export async function GET(req) {
  try {
    await requireRole(req, ['admin']);

    // Fetch Candidates, Employees, Companies, and Competitions in parallel
    const [usersRes, empRes, compRes, compsRes] = await Promise.all([
      pool.query(
        `SELECT id, firstname, lastname, email, role, phone, created_at as "createdAt" 
         FROM users 
         WHERE role NOT IN ('company_admin', 'company_employee') AND is_deleted = false 
         ORDER BY created_at DESC`
      ),
      pool.query(
        `SELECT u.id, u.firstname, u.lastname, u.email, u.role, u.phone, u.created_at as "createdAt",
                comp.id as "companyId", comp.name as "companyName"
         FROM users u
         LEFT JOIN companies comp ON u.company_id = comp.id
         WHERE u.role = 'company_employee' AND u.is_deleted = false
         ORDER BY u.created_at DESC`
      ),
      pool.query(
        `SELECT c.id, c.name, c.place, c.description, c.website, c.is_verified as "isVerified", c.created_at as "createdAt",
                u.id as "adminId", u.firstname as "adminFirst", u.lastname as "adminLast", u.email as "adminEmail"
         FROM companies c
         LEFT JOIN users u ON c.admin_id = u.id
         WHERE c.is_deleted = false
         ORDER BY c.created_at DESC`
      ),
      pool.query(
        `SELECT comp.id, comp.title, comp.experience_required as "experienceRequired", comp.skills_required as "skillsRequired", comp.created_at as "createdAt",
                c.id as "companyId", c.name as "companyName",
                u.id as "creatorId", u.firstname as "creatorFirst", u.lastname as "creatorLast"
         FROM competitions comp
         INNER JOIN companies c ON comp.company_id = c.id
         INNER JOIN users u ON comp.created_by = u.id
         WHERE comp.is_deleted = false
         ORDER BY comp.created_at DESC`
      )
    ]);

    const users = usersRes.rows.map(row => ({
      _id: row.id.toString(),
      id: row.id,
      firstname: row.firstname,
      lastname: row.lastname,
      email: row.email,
      role: row.role,
      phone: row.phone || '',
      createdAt: row.createdAt
    }));

    const employees = empRes.rows.map(row => ({
      _id: row.id.toString(),
      id: row.id,
      firstname: row.firstname,
      lastname: row.lastname,
      email: row.email,
      role: row.role,
      phone: row.phone || '',
      createdAt: row.createdAt,
      companyId: row.companyId ? {
        _id: row.companyId.toString(),
        id: row.companyId,
        name: row.companyName
      } : null
    }));

    const companies = compRes.rows.map(row => ({
      _id: row.id.toString(),
      id: row.id,
      name: row.name,
      place: row.place,
      description: row.description || '',
      website: row.website || '',
      isVerified: row.isVerified,
      createdAt: row.createdAt,
      adminId: row.adminId ? {
        _id: row.adminId.toString(),
        id: row.adminId,
        firstname: row.adminFirst,
        lastname: row.adminLast,
        email: row.adminEmail
      } : null
    }));

    // 4. Map Competitions data
    const competitions = compsRes.rows.map(row => ({
      _id: row.id.toString(),
      id: row.id,
      title: row.title,
      experienceRequired: row.experienceRequired,
      skillsRequired: row.skillsRequired || [],
      createdAt: row.createdAt,
      companyId: {
        _id: row.companyId.toString(),
        id: row.companyId,
        name: row.companyName
      },
      createdBy: {
        _id: row.creatorId.toString(),
        id: row.creatorId,
        firstname: row.creatorFirst,
        lastname: row.creatorLast
      }
    }));

    return NextResponse.json({ users, employees, companies, competitions }, { status: 200 });
  } catch (err) {
    console.error('Admin Fetch Users API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch directory data' }, { status: 500 });
  }
}
