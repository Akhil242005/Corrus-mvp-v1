import { syncSubmissions } from './lib/syncSubmissions';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Guard against duplicate intervals on Next.js hot-reloads
    if (globalThis.__submissions_sync_loop_active__) return;
    globalThis.__submissions_sync_loop_active__ = true;

    console.log('[Corrus Sync] Spawning background submissions synchronization worker...');

    // Run every 15 seconds
    setInterval(async () => {
      try {
        const res = await syncSubmissions();
        if (res.syncedCount > 0) {
          console.log(`[Corrus Sync] Synchronized ${res.syncedCount} evaluation verdicts from analyzer.`);
        }
      } catch (err) {
        console.error('[Corrus Sync] Background synchronization error:', err);
      }
    }, 15000);
  }
}
