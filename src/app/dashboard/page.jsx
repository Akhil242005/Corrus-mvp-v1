'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CandidateDashboardPage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to explore sub-route
    router.replace('/dashboard/explore');
  }, [router]);

  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-2"></div>
      <span className="text-slate-500 font-semibold ml-3">Loading candidate console...</span>
    </div>
  );
}
