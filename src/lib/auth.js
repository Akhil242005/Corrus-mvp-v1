import jwt from 'jsonwebtoken';
import pool from './db';
import { NextResponse } from 'next/server';

// Extract JWT token from header and verify it
export async function authenticateToken(req) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    throw new Error('Access token required');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // If token has passwordResetRequired claim, restrict to reset endpoints only
    if (decoded.passwordResetRequired) {
      const pathname = req.nextUrl ? req.nextUrl.pathname : '';
      const allowedPaths = [
        '/api/company/request-password-reset-otp',
        '/api/company/confirm-password-reset'
      ];
      if (!allowedPaths.includes(pathname)) {
        throw new Error('Access denied: Password reset required');
      }
    }

    return decoded;
  } catch (err) {
    if (err.message === 'Access denied: Password reset required') {
      throw err;
    }
    throw new Error('Invalid or expired token');
  }
}

// Restrict route to specific roles
export async function requireRole(req, allowedRoles) {
  const user = await authenticateToken(req);
  
  // Verify user is active in PostgreSQL database
  const userRes = await pool.query(
    'SELECT id, firstname, lastname, email, role, company_id, is_approved FROM users WHERE id = $1 AND is_deleted = false',
    [user.userId]
  );
  
  if (userRes.rows.length === 0) {
    throw new Error('User not found or account deactivated');
  }

  const dbUser = userRes.rows[0];

  if (!allowedRoles.includes(dbUser.role)) {
    throw new Error('Access denied: Unauthorized role');
  }

  // Handle company employee approval check
  if (dbUser.role === 'company_employee' && !dbUser.is_approved) {
    throw new Error('Your employee account is pending approval by company admin.');
  }

  return dbUser;
}

// Log actions to the audit_logs table
export async function logAudit({
  action,
  performedBy, // userId (integer) or null
  targetType, // string ('User', 'Company', 'Competition', 'System')
  targetId, // integer or null
  changes = null, // JSON object
  details = '',
  targetName = 'N/A',
  targetEmail = 'N/A'
}) {
  try {
    let name = 'System / Unauthenticated';
    let email = 'N/A';

    if (performedBy) {
      const uRes = await pool.query('SELECT firstname, lastname, email FROM users WHERE id = $1 AND is_deleted = false', [performedBy]);
      if (uRes.rows.length > 0) {
        const u = uRes.rows[0];
        name = `${u.firstname || ''} ${u.lastname || ''}`.trim() || u.email;
        email = u.email;
      }
    }

    let finalTargetName = targetName;
    let finalTargetEmail = targetEmail;

    if (targetId && targetType && (finalTargetName === 'N/A' || finalTargetEmail === 'N/A')) {
      if (targetType === 'User') {
        const targetRes = await pool.query('SELECT firstname, lastname, email FROM users WHERE id = $1', [targetId]);
        if (targetRes.rows.length > 0) {
          const targetUser = targetRes.rows[0];
          if (finalTargetName === 'N/A') {
            finalTargetName = `${targetUser.firstname || ''} ${targetUser.lastname || ''}`.trim() || targetUser.email;
          }
          if (finalTargetEmail === 'N/A') {
            finalTargetEmail = targetUser.email || 'N/A';
          }
        }
      } else if (targetType === 'Company') {
        const targetRes = await pool.query(
          `SELECT c.name, u.email FROM companies c 
           LEFT JOIN users u ON c.admin_id = u.id 
           WHERE c.id = $1`,
          [targetId]
        );
        if (targetRes.rows.length > 0) {
          const targetComp = targetRes.rows[0];
          if (finalTargetName === 'N/A') {
            finalTargetName = targetComp.name || 'N/A';
          }
          if (finalTargetEmail === 'N/A') {
            finalTargetEmail = targetComp.email || 'N/A';
          }
        }
      } else if (targetType === 'Competition') {
        const targetRes = await pool.query(
          `SELECT comp.title, u.email FROM competitions comp 
           LEFT JOIN users u ON comp.created_by = u.id 
           WHERE comp.id = $1`,
          [targetId]
        );
        if (targetRes.rows.length > 0) {
          const targetComp = targetRes.rows[0];
          if (finalTargetName === 'N/A') {
            finalTargetName = targetComp.title || 'N/A';
          }
          if (finalTargetEmail === 'N/A') {
            finalTargetEmail = targetComp.email || 'N/A';
          }
        }
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (action, performed_by, performed_by_name, performed_by_email, target_type, target_id, target_name, target_email, changes, details) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        action,
        performedBy,
        name,
        email,
        targetType,
        targetId,
        finalTargetName,
        finalTargetEmail,
        changes ? JSON.stringify(changes) : null,
        details
      ]
    );
  } catch (err) {
    console.error('Audit Logging Error:', err);
  }
}

// Maps requireRole/authenticateToken error strings to 401/403 NextResponse payloads
export function handleAuthError(err) {
  const authErrors = [
    'Access token required',
    'Invalid or expired token',
    'User not found or account deactivated'
  ];
  const forbiddenErrors = [
    'Access denied: Unauthorized role',
    'Your employee account is pending approval by company admin.',
    'Company association not found'
  ];

  if (err.message === 'Access denied: Password reset required') {
    return NextResponse.json({ error: 'Password reset required', passwordResetRequired: true }, { status: 403 });
  }

  if (authErrors.includes(err.message)) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (forbiddenErrors.includes(err.message)) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  return null;
}

