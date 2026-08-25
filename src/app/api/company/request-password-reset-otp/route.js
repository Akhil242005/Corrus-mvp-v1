import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { authenticateToken, handleAuthError } from '@/lib/auth';
import nodemailer from 'nodemailer';

export async function POST(req) {
  try {
    const user = await authenticateToken(req);

    // Verify user role is employee and must reset password
    const userRes = await pool.query(
      'SELECT id, email, role, must_reset_password FROM users WHERE id = $1 AND is_deleted = false',
      [user.userId]
    );

    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const dbUser = userRes.rows[0];
    if (dbUser.role !== 'company_employee') {
      return NextResponse.json({ error: 'Access denied: Password reset OTP is for employees only' }, { status: 403 });
    }
    if (!dbUser.must_reset_password) {
      return NextResponse.json({ error: 'Password reset is not required for this account' }, { status: 400 });
    }

    // Generate random 6-digit verification code
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save to database
    await pool.query(
      'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3',
      [otpCode, otpExpiresAt, dbUser.id]
    );

    // Send email via Nodemailer using Gmail SMTP or mock console log
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

    if (gmailAppPassword && gmailUser) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { 
            user: gmailUser, 
            pass: gmailAppPassword 
          }
        });

        await transporter.sendMail({
          from: `"Corrus Security" <${gmailUser}>`,
          to: dbUser.email,
          subject: 'Corrus Employee Password Verification Code',
          html: `<p>Hello,</p><p>You are receiving this email because a password reset is required on your company employee account.</p><p>Your verification code is: <strong>${otpCode}</strong> (Expires in 10 minutes).</p>`
        });
      } catch (err) {
        console.error('Failed to trigger email delivery via Nodemailer/Gmail:', err);
        return NextResponse.json({ error: `Gmail SMTP Error: ${err.message || 'Failed to send verification code'}` }, { status: 400 });
      }
    } else {
      console.log(`[EMAIL OTP MOCK] Verification Code for employee ${dbUser.email} is: ${otpCode}`);
    }

    return NextResponse.json({ message: 'Verification OTP sent successfully' }, { status: 200 });
  } catch (err) {
    const authRes = handleAuthError(err);
    if (authRes) return authRes;

    console.error('Request OTP API Error:', err);
    return NextResponse.json({ error: 'Server error requesting password reset OTP' }, { status: 500 });
  }
}
