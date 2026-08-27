import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { closeCompetitionSubmissions } from '@/lib/githubClose';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    // 1. Auth check using shared secret header
    const authHeader = req.headers.get('authorization');
    const xCronSecret = req.headers.get('x-cron-secret');
    const cronSecret = process.env.CRON_SECRET || 'super-secret-cron-token';

    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    const providedSecret = token || xCronSecret;

    if (!providedSecret || providedSecret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized: invalid cron secret' }, { status: 401 });
    }

    // 2. Query expired competitions with auto-close active
    const expiredRes = await pool.query(
      `SELECT id, title 
       FROM competitions 
       WHERE auto_close_enabled = true 
         AND submission_deadline < CURRENT_TIMESTAMP 
         AND closed_at IS NULL 
         AND is_deleted = false`
    );

    const competitionsToClose = expiredRes.rows;
    const results = [];

    // 3. Process collaborator permission downgrades
    for (const comp of competitionsToClose) {
      try {
        console.log(`[AUTO-CLOSE] Processing auto-close for competition ID ${comp.id} ("${comp.title}")`);
        const res = await closeCompetitionSubmissions(comp.id, null); // null indicates system-triggered
        results.push({
          competitionId: comp.id,
          title: comp.title,
          status: 'closed',
          successCount: res.successCount,
          failCount: res.failCount
        });
      } catch (err) {
        console.error(`[AUTO-CLOSE] Failed to auto-close competition ${comp.id}:`, err);
        results.push({
          competitionId: comp.id,
          title: comp.title,
          status: 'failed',
          error: err.message
        });
      }
    }

    return NextResponse.json({
      message: 'Automated deadline submissions check complete.',
      processedCount: competitionsToClose.length,
      details: results
    }, { status: 200 });

  } catch (err) {
    console.error('Auto Close Scheduler API Exception:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
