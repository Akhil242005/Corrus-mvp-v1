import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '@/lib/db';
import { authenticateToken, handleAuthError, logAudit } from '@/lib/auth';

export async function POST(req) {
  try {
    const userClaim = await authenticateToken(req);
    const { otpCode, newPassword } = await req.json();

    if (!otpCode || !newPassword || String(newPassword).trim() === '') {
      return NextResponse.json({ error: 'Verification code and new password are required' }, { status: 400 });
    }

    // Retrieve user and OTP metadata
    const userRes = await pool.query(
      'SELECT id, email, firstname, role, company_id, otp_code, otp_expires_at, must_reset_password FROM users WHERE id = $1 AND is_deleted = false',
      [userClaim.userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const dbUser = userRes.rows[0];
    if (dbUser.role !== 'company_employee') {
      return NextResponse.json({ error: 'Access denied: Password reset is for employees only' }, { status: 403 });
    }
    if (!dbUser.must_reset_password) {
      return NextResponse.json({ error: 'Password reset is not required for this account' }, { status: 400 });
    }

    // Verify OTP code exists and matches
    if (!dbUser.otp_code || dbUser.otp_code !== String(otpCode).trim()) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // Verify OTP expiry
    if (new Date() > new Date(dbUser.otp_expires_at)) {
      return NextResponse.json({ error: 'Verification code has expired' }, { status: 400 });
    }

    // Hash and store the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password = $1, must_reset_password = false, otp_code = null, otp_expires_at = null WHERE id = $2',
      [hashedPassword, dbUser.id]
    );

    // Log audit completion event
    await logAudit({
      action: 'EMPLOYEE_PASSWORD_RESET_COMPLETED',
      performedBy: dbUser.id,
      targetType: 'User',
      targetId: dbUser.id,
      details: `Employee ${dbUser.email} successfully completed forced password reset`
    });

    // Generate normal full-access JWT
    const token = jwt.sign(
      { 
        userId: dbUser.id.toString(), 
        email: dbUser.email, 
        firstname: dbUser.firstname, 
        role: dbUser.role,
        companyId: dbUser.company_id ? dbUser.company_id.toString() : null 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return NextResponse.json({ message: 'Password reset completed successfully', token }, { status: 200 });
  } catch (err) {
    const authRes = handleAuthError(err);
    if (authRes) return authRes;

    console.error('Confirm Password Reset API Error:', err);
    return NextResponse.json({ error: 'Server error confirming password reset' }, { status: 500 });
  }
}
