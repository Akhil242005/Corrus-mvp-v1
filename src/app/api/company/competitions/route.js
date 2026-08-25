import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

export async function POST(req) {
  try {
    const user = await requireRole(req, ['company_admin', 'company_employee']);
    const companyId = user.company_id;

    if (!companyId) {
      return NextResponse.json({ error: 'Company association not found' }, { status: 403 });
    }

    // Verify company status
    const compCheck = await pool.query('SELECT is_verified FROM companies WHERE id = $1', [companyId]);
    if (compCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Company details not found' }, { status: 404 });
    }

    const company = compCheck.rows[0];
    if (!company.is_verified) {
      return NextResponse.json(
        { error: 'Your company details must be verified by a Platform Admin before posting hiring competitions.' },
        { status: 403 }
      );
    }

    // Verify GitHub App installation exists before allowing competition creation
    const installCheck = await pool.query(
      'SELECT id FROM installations WHERE company_id = $1 AND is_deleted = false LIMIT 1',
      [companyId]
    );
    if (installCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'GitHub Integration Required: You must complete the GitHub App installation before creating hiring competitions.' },
        { status: 403 }
      );
    }

    const { title, taskDescription, language, skillsRequired, experienceRequired, otherRequirements, githubTemplateRepo } = await req.json();

    if (!title || !taskDescription || !language || !experienceRequired) {
      return NextResponse.json({ error: 'Title, task description, language, and experience requirement are required' }, { status: 400 });
    }

    const allowedLanguages = ['Python', 'JavaScript/TypeScript', 'C++'];
    if (!allowedLanguages.includes(language)) {
      return NextResponse.json({ error: `Language must be one of: ${allowedLanguages.join(', ')}` }, { status: 400 });
    }

    const skillsArray = Array.isArray(skillsRequired)
      ? skillsRequired
      : (skillsRequired ? skillsRequired.split(',').map(s => s.trim()).filter(Boolean) : []);

    const insertRes = await pool.query(
      `INSERT INTO competitions (company_id, title, task_description, language, skills_required, experience_required, other_requirements, github_template_repo, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, title, task_description as "taskDescription", language, skills_required as "skillsRequired", 
                 experience_required as "experienceRequired", other_requirements as "otherRequirements", github_template_repo as "githubTemplateRepo", created_at as "createdAt"`,
      [companyId, title, taskDescription, language, skillsArray, experienceRequired, otherRequirements || '', githubTemplateRepo || null, user.id]
    );

    const competition = insertRes.rows[0];

    await logAudit({
      action: 'CREATE_COMPETITION',
      performedBy: user.id,
      targetType: 'Competition',
      targetId: competition.id,
      details: `Competition "${title}" created by company ID ${companyId} in language ${language}`
    });

    const formattedCompetition = {
      _id: competition.id.toString(),
      id: competition.id,
      title: competition.title,
      taskDescription: competition.taskDescription,
      language: competition.language,
      skillsRequired: competition.skillsRequired,
      experienceRequired: competition.experienceRequired,
      otherRequirements: competition.otherRequirements,
      githubTemplateRepo: competition.githubTemplateRepo,
      createdAt: competition.createdAt
    };

    return NextResponse.json({ message: 'Hiring competition created successfully!', competition: formattedCompetition }, { status: 201 });
  } catch (err) {
    console.error('Create Competition API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create competition' }, { status: 500 });
  }
}
