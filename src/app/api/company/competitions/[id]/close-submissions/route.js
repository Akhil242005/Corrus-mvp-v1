import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { closeCompetitionSubmissions } from '@/lib/githubClose';

export async function POST(req, { params }) {
  try {
    const user = await requireRole(req, ['company_admin', 'company_employee']);
    const { id: competitionIdStr } = await params;
    const competitionId = parseInt(competitionIdStr, 10);

    if (isNaN(competitionId)) {
      return NextResponse.json({ error: 'Invalid competition ID' }, { status: 400 });
    }

    const result = await closeCompetitionSubmissions(competitionId, user.id);

    if (result.alreadyClosed) {
      return NextResponse.json({ error: 'Submissions are already closed for this competition' }, { status: 400 });
    }

    return NextResponse.json({
      message: 'Hiring competition submissions closed successfully.',
      successCount: result.successCount,
      failCount: result.failCount
    }, { status: 200 });

  } catch (err) {
    console.error('Close Submissions API Error:', err);
    return NextResponse.json({ error: err.message || 'Failed to close submissions' }, { status: 500 });
  }
}
