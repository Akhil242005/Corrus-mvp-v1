import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

export async function DELETE(req, { params }) {
  try {
    const user = await requireRole(req, ['company_admin', 'company_employee']);
    const { id: competitionIdStr } = await params;
    const competitionId = parseInt(competitionIdStr, 10);

    if (isNaN(competitionId)) {
      return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
    }

    const companyId = user.company_id;

    const deleteRes = await pool.query(
      `UPDATE competitions 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND company_id = $2 AND is_deleted = false 
       RETURNING id, title`,
      [competitionId, companyId]
    );

    if (deleteRes.rows.length === 0) {
      return NextResponse.json({ error: 'Competition not found or unauthorized.' }, { status: 404 });
    }

    const competition = deleteRes.rows[0];

    await logAudit({
      action: 'DELETE_COMPETITION',
      performedBy: user.id,
      targetType: 'Competition',
      targetId: competition.id,
      details: `Company user deleted competition: ${competition.title}`
    });

    return NextResponse.json({ message: 'Competition soft-deleted successfully' }, { status: 200 });
  } catch (err) {
    console.error('Delete Company Competition API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete company competition' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const user = await requireRole(req, ['company_admin', 'company_employee']);
    const { id: competitionIdStr } = await params;
    const competitionId = parseInt(competitionIdStr, 10);

    if (isNaN(competitionId)) {
      return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
    }

    const companyId = user.company_id;

    // Get current state for audit logging
    const checkRes = await pool.query(
      'SELECT id, title, submission_deadline, auto_close_enabled FROM competitions WHERE id = $1 AND company_id = $2 AND is_deleted = false',
      [competitionId, companyId]
    );

    if (checkRes.rows.length === 0) {
      return NextResponse.json({ error: 'Competition not found or unauthorized.' }, { status: 404 });
    }

    const oldComp = checkRes.rows[0];

    const body = await req.json();
    const { submissionDeadline, autoCloseEnabled } = body;

    // Perform database update
    const updateRes = await pool.query(
      `UPDATE competitions 
       SET submission_deadline = $1, auto_close_enabled = $2 
       WHERE id = $3 AND company_id = $4 AND is_deleted = false 
       RETURNING id, title, submission_deadline, auto_close_enabled`,
      [
        submissionDeadline ? new Date(submissionDeadline) : null,
        !!autoCloseEnabled,
        competitionId,
        companyId
      ]
    );

    const updatedComp = updateRes.rows[0];

    // Log audit action with old/new changes
    await logAudit({
      action: 'COMPETITION_DEADLINE_UPDATED',
      performedBy: user.id,
      targetType: 'Competition',
      targetId: updatedComp.id,
      changes: {
        submissionDeadline: {
          old: oldComp.submission_deadline ? new Date(oldComp.submission_deadline).toISOString() : 'None',
          new: updatedComp.submission_deadline ? new Date(updatedComp.submission_deadline).toISOString() : 'None'
        },
        autoCloseEnabled: {
          old: !!oldComp.auto_close_enabled,
          new: !!updatedComp.auto_close_enabled
        }
      },
      details: `Updated deadline and auto-close rules for competition "${updatedComp.title}"`
    });

    return NextResponse.json({
      message: 'Competition updated successfully',
      competition: {
        id: updatedComp.id,
        title: updatedComp.title,
        submissionDeadline: updatedComp.submission_deadline,
        autoCloseEnabled: updatedComp.auto_close_enabled
      }
    }, { status: 200 });
  } catch (err) {
    console.error('PUT Company Competition API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update company competition' }, { status: 500 });
  }
}
