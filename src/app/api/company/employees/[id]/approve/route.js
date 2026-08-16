import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

export async function PUT(req, { params }) {
  try {
    const admin = await requireRole(req, ['company_admin']);
    const { id: employeeIdStr } = await params;
    const employeeId = parseInt(employeeIdStr, 10);

    if (isNaN(employeeId)) {
      return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
    }

    const { isApproved } = await req.json();

    // Query and update employee account under company
    const employeeRes = await pool.query(
      `SELECT id, email, is_approved FROM users 
       WHERE id = $1 AND company_id = $2 AND role = 'company_employee' AND is_deleted = false`,
      [employeeId, admin.company_id]
    );

    if (employeeRes.rows.length === 0) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const employee = employeeRes.rows[0];
    const oldStatus = employee.is_approved;
    const nextStatus = Boolean(isApproved);

    await pool.query(
      'UPDATE users SET is_approved = $1 WHERE id = $2',
      [nextStatus, employeeId]
    );

    await logAudit({
      action: nextStatus ? 'APPROVE_EMPLOYEE' : 'REVOKE_EMPLOYEE',
      performedBy: admin.id,
      targetType: 'User',
      targetId: employee.id,
      changes: { isApproved: { old: oldStatus, new: nextStatus } },
      details: `Employee access ${nextStatus ? 'approved' : 'revoked'} for ${employee.email}`
    });

    const updatedRes = await pool.query(
      'SELECT id, firstname, lastname, email, phone, is_approved as "isApproved", created_at as "createdAt" FROM users WHERE id = $1',
      [employeeId]
    );
    const updatedEmployee = updatedRes.rows[0];

    const formattedEmployee = {
      _id: updatedEmployee.id.toString(),
      id: updatedEmployee.id,
      firstname: updatedEmployee.firstname,
      lastname: updatedEmployee.lastname,
      email: updatedEmployee.email,
      phone: updatedEmployee.phone || '',
      isApproved: updatedEmployee.isApproved,
      createdAt: updatedEmployee.createdAt
    };

    return NextResponse.json({ message: `Employee ${nextStatus ? 'approved' : 'revoked'} successfully`, employee: formattedEmployee }, { status: 200 });
  } catch (err) {
    console.error('Approve Employee API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update employee status' }, { status: 500 });
  }
}
