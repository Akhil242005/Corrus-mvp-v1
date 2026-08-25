import { NextResponse } from 'next/server';
import { syncSubmissions } from '@/lib/syncSubmissions';

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader && authHeader.split(' ')[1];
    const expectedSecret = process.env.SYNC_CRON_SECRET;

    if (expectedSecret && token !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized sync request' }, { status: 401 });
    }

    const result = await syncSubmissions();
    return NextResponse.json({ message: 'Sync cycle completed successfully', ...result }, { status: 200 });
  } catch (err) {
    console.error('API Sync trigger error:', err);
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get('key');
    const expectedSecret = process.env.SYNC_CRON_SECRET;

    if (expectedSecret && key !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized sync request' }, { status: 401 });
    }

    const result = await syncSubmissions();
    return NextResponse.json({ message: 'Sync cycle completed successfully', ...result }, { status: 200 });
  } catch (err) {
    console.error('API Sync trigger error:', err);
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 });
  }
}
