import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireRole } from '@/lib/auth';

export async function GET(req) {
  try {
    await requireRole(req, ['admin']);

    const query = `
      SELECT id, action, performed_by as "performedBy", performed_by_name as "performedByName", 
             performed_by_email as "performedByEmail", target_type as "targetType", 
             target_id as "targetId", target_name as "targetName", target_email as "targetEmail", 
             changes, details, timestamp 
      FROM audit_logs 
      ORDER BY timestamp DESC 
      LIMIT 200
    `;

    const res = await pool.query(query);

    const logs = res.rows.map(row => ({
      _id: row.id.toString(),
      id: row.id,
      action: row.action,
      performedBy: row.performedBy,
      performedByName: row.performedByName,
      performedByEmail: row.performedByEmail,
      targetType: row.targetType,
      targetId: row.targetId,
      targetName: row.targetName,
      targetEmail: row.targetEmail,
      changes: row.changes ? (typeof row.changes === 'string' ? JSON.parse(row.changes) : row.changes) : null,
      details: row.details,
      timestamp: row.timestamp
    }));

    return NextResponse.json(logs, { status: 200 });
  } catch (err) {
    console.error('Audit Logs API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}
