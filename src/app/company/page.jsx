'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CompanyPage() {
  const router = useRouter();

  useEffect(() => {
    // Automatically redirect to overview sub-route
    router.replace('/company/overview');
  }, [router]);

  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-2"></div>
      <span className="text-slate-500 font-semibold ml-3">Loading company console...</span>
    </div>
  );
}
