import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import pool from '@/lib/db';
import { authenticateToken, logAudit } from '@/lib/auth';

const PHONE_REGEX = /^[0-9]{10}$/;

function validatePhone(phone) {
  if (!phone || String(phone).trim() === '') return true;
  return PHONE_REGEX.test(String(phone).trim());
}

// GET User Profile
export async function GET(req) {
  try {
    const user = await authenticateToken(req);

    const userRes = await pool.query(
      `SELECT id, firstname, lastname, email, phone, role, company_id, 
              is_approved, experience, skills, education, projects, resume_url, created_at 
       FROM users WHERE id = $1 AND is_deleted = false`,
      [user.userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const dbUser = userRes.rows[0];

    // Format structure to match client expectation (Mongoose compatibility)
    const formattedUser = {
      _id: dbUser.id.toString(),
      id: dbUser.id,
      firstname: dbUser.firstname,
      lastname: dbUser.lastname,
      email: dbUser.email,
      phone: dbUser.phone || '',
      role: dbUser.role,
      companyId: dbUser.company_id,
      isApproved: dbUser.is_approved,
      experience: dbUser.experience || '',
      skills: dbUser.skills || [],
      education: dbUser.education || '',
      projects: dbUser.projects || '',
      resumeUrl: dbUser.resume_url || '',
      createdAt: dbUser.created_at
    };

    return NextResponse.json(formattedUser, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Authentication failed' }, { status: 401 });
  }
}

// PUT Update User Profile (Handles resume uploads)
export async function PUT(req) {
  try {
    const user = await authenticateToken(req);

    // Read form data
    const formData = await req.formData();
    const firstname = formData.get('firstname');
    const lastname = formData.get('lastname') || '';
    const phone = formData.get('phone') || '';
    const experience = formData.get('experience') || '';
    const skills = formData.get('skills') || '';
    const education = formData.get('education') || '';
    const projects = formData.get('projects') || '';
    const file = formData.get('resume'); // This is either a File object or null/string

    if (!firstname) {
      return NextResponse.json({ error: 'First name is required.' }, { status: 400 });
    }
    if (phone && !validatePhone(phone)) {
      return NextResponse.json({ error: 'Phone number must be exactly 10 digits' }, { status: 400 });
    }

    // Get current database user details
    const existingRes = await pool.query('SELECT * FROM users WHERE id = $1 AND is_deleted = false', [user.userId]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const dbUser = existingRes.rows[0];

    // Verify phone number uniqueness
    if (phone && phone.trim()) {
      const phoneConflict = await pool.query(
        'SELECT id FROM users WHERE phone = $1 AND id != $2 AND is_deleted = false',
        [phone.trim(), user.userId]
      );
      if (phoneConflict.rows.length > 0) {
        return NextResponse.json({ error: 'Phone number is already registered' }, { status: 400 });
      }
    }

    let resumeUrl = dbUser.resume_url || '';

    // Handle File Upload if provided
    if (file && typeof file === 'object' && file.name) {
      const size = file.size;
      const mimetype = file.type;

      // Validate size (50KB min, 5MB max)
      if (size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'File size exceeds the 5MB limit.' }, { status: 400 });
      }
      if (size < 50 * 1024) {
        return NextResponse.json({ error: 'File size too small. Resume must be at least 50 KB.' }, { status: 400 });
      }

      // Validate type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (!allowedTypes.includes(mimetype)) {
        return NextResponse.json({ error: 'Invalid file type. Only PDF, DOC, and DOCX files are allowed.' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'resumes');

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const ext = path.extname(file.name);
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const filename = `resume-${user.userId}-${uniqueSuffix}${ext}`;
      const filePath = path.join(uploadDir, filename);

      await fs.promises.writeFile(filePath, buffer);
      resumeUrl = `/uploads/resumes/${filename}`;
    }

    let skillsArray = [];
    if (skills) {
      if (typeof skills === 'string') {
        skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
      } else if (Array.isArray(skills)) {
        skillsArray = skills;
      }
    }

    const updateData = {
      firstname,
      lastname,
      phone: phone ? phone.trim() : null,
      experience,
      skills: skillsArray,
      education,
      projects,
      resume_url: resumeUrl
    };

    // Calculate changes for Audit Log
    const changes = {};
    const fieldMapping = {
      firstname: 'firstname',
      lastname: 'lastname',
      phone: 'phone',
      experience: 'experience',
      skills: 'skills',
      education: 'education',
      projects: 'projects',
      resume_url: 'resumeUrl'
    };

    for (const [col, fieldName] of Object.entries(fieldMapping)) {
      const oldVal = dbUser[col];
      const newVal = updateData[col];

      const oldStr = Array.isArray(oldVal) ? oldVal.join(', ') : (oldVal || '');
      const newStr = Array.isArray(newVal) ? newVal.join(', ') : (newVal || '');

      if (oldStr !== newStr) {
        changes[fieldName] = { old: oldStr || 'N/A', new: newStr || 'N/A' };
      }
    }

    // Save update to database
    await pool.query(
      `UPDATE users 
       SET firstname = $1, lastname = $2, phone = $3, experience = $4, skills = $5, education = $6, projects = $7, resume_url = $8 
       WHERE id = $9`,
      [
        updateData.firstname,
        updateData.lastname,
        updateData.phone,
        updateData.experience,
        updateData.skills,
        updateData.education,
        updateData.projects,
        updateData.resume_url,
        user.userId
      ]
    );

    // Fetch updated user info
    const updatedRes = await pool.query('SELECT * FROM users WHERE id = $1', [user.userId]);
    const updatedUser = updatedRes.rows[0];

    await logAudit({
      action: 'UPDATE_PROFILE',
      performedBy: user.userId,
      targetType: 'User',
      targetId: updatedUser.id,
      changes: Object.keys(changes).length ? changes : null,
      details: `Candidate profile updated for ${updatedUser.email}`
    });

    const formattedUser = {
      _id: updatedUser.id.toString(),
      id: updatedUser.id,
      firstname: updatedUser.firstname,
      lastname: updatedUser.lastname,
      email: updatedUser.email,
      phone: updatedUser.phone || '',
      role: updatedUser.role,
      companyId: updatedUser.company_id,
      isApproved: updatedUser.is_approved,
      experience: updatedUser.experience || '',
      skills: updatedUser.skills || [],
      education: updatedUser.education || '',
      projects: updatedUser.projects || '',
      resumeUrl: updatedUser.resume_url || ''
    };

    return NextResponse.json({ message: 'Profile updated successfully!', user: formattedUser }, { status: 200 });
  } catch (err) {
    console.error('Update Profile API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update profile' }, { status: 500 });
  }
}
