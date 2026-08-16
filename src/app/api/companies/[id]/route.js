import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authenticateToken } from '@/lib/auth';

export async function GET(req, { params }) {
  try {
    await authenticateToken(req);
    const { id: companyIdStr } = await params;
    const companyId = parseInt(companyIdStr, 10);

    if (isNaN(companyId)) {
      return NextResponse.json({ error: 'Invalid company ID' }, { status: 400 });
    }

    const companyRes = await pool.query(
      'SELECT id, name, place, description, website, is_verified as "isVerified" FROM companies WHERE id = $1 AND is_deleted = false',
      [companyId]
    );

    if (companyRes.rows.length === 0) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const company = companyRes.rows[0];

    // Format structure to match client expectations
    const formattedCompany = {
      _id: company.id.toString(),
      id: company.id,
      name: company.name,
      place: company.place,
      description: company.description || '',
      website: company.website || '',
      isVerified: company.isVerified
    };

    // Get active competitions for company
    const compsRes = await pool.query(
      `SELECT id, title, task_description as "taskDescription", skills_required as "skillsRequired", 
              experience_required as "experienceRequired", other_requirements as "otherRequirements", created_at as "createdAt"
       FROM competitions 
       WHERE company_id = $1 AND is_deleted = false 
       ORDER BY created_at DESC`,
      [companyId]
    );

    const competitions = compsRes.rows.map(row => ({
      _id: row.id.toString(),
      id: row.id,
      title: row.title,
      taskDescription: row.taskDescription,
      skillsRequired: row.skillsRequired || [],
      experienceRequired: row.experienceRequired,
      otherRequirements: row.otherRequirements || '',
      createdAt: row.createdAt
    }));

    return NextResponse.json({ company: formattedCompany, competitions }, { status: 200 });
  } catch (err) {
    console.error('Companies API Exception:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch company profile' }, { status: 500 });
  }
}
