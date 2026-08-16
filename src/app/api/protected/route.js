import { NextResponse } from 'next/server';
import { authenticateToken } from '@/lib/auth';

export async function GET(req) {
  try {
    const user = await authenticateToken(req);
    return NextResponse.json({
      message: `Hello ${user.firstname || user.email}, Welcome to the dashboard!`
    }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Access denied' }, { status: 401 });
  }
}
