import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authenticateToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    // Authenticate token
    const decoded = await authenticateToken(req);
    const userId = parseInt(decoded.userId || decoded.id, 10);

    const query = `
      SELECT c.id, c.title, c.task_description as "taskDescription", c.skills_required as "skillsRequired", 
             c.experience_required as "experienceRequired", c.other_requirements as "otherRequirements", c.created_at as "createdAt",
             comp.id as "companyId", comp.name as "companyName", comp.place as "companyPlace", 
             comp.description as "companyDesc", comp.website as "companyWeb", comp.is_verified as "companyVerified",
             u.firstname as "creatorFirst", u.lastname as "creatorLast"
      FROM competitions c
      INNER JOIN companies comp ON c.company_id = comp.id
      INNER JOIN users u ON c.created_by = u.id
      WHERE c.is_deleted = false AND comp.is_deleted = false
      ORDER BY c.created_at DESC
    `;

    const res = await pool.query(query);

    // Fetch all enrollments to map enrolled users and repo URLs
    const enrollmentsRes = await pool.query('SELECT competition_id, user_id, repo_url FROM competition_enrollments');
    const enrollMap = {};
    const userRepoMap = {};

    enrollmentsRes.rows.forEach(row => {
      if (!enrollMap[row.competition_id]) {
        enrollMap[row.competition_id] = [];
      }
      enrollMap[row.competition_id].push(row.user_id);

      if (Number(row.user_id) === Number(userId)) {
        userRepoMap[row.competition_id] = row.repo_url;
      }
    });

    const competitions = res.rows.map(row => ({
      _id: row.id.toString(),
      id: row.id,
      title: row.title,
      taskDescription: row.taskDescription,
      skillsRequired: row.skillsRequired || [],
      experienceRequired: row.experienceRequired,
      otherRequirements: row.otherRequirements || '',
      createdAt: row.createdAt,
      enrolledUsers: enrollMap[row.id] || [],
      enrolledRepoUrl: userRepoMap[row.id] || null,
      companyId: {
        _id: row.companyId.toString(),
        id: row.companyId,
        name: row.companyName,
        place: row.companyPlace,
        description: row.companyDesc || '',
        website: row.companyWeb || '',
        isVerified: row.companyVerified
      },
      createdBy: {
        firstname: row.creatorFirst,
        lastname: row.creatorLast
      }
    }));

    return NextResponse.json(competitions, { status: 200 });
  } catch (err) {
    console.error('Competitions API Exception:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch competitions' }, { status: 500 });
  }
}
