'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const installationId = searchParams.get('installation_id');
    const setupAction = searchParams.get('setup_action');

    if (!installationId) {
      setError('Installation ID is missing from callback query parameters.');
      return;
    }

    const token = localStorage.getItem('corrus_company_token');
    if (!token) {
      router.push('/company-auth?error=Session+expired.+Please+log+in+again.');
      return;
    }

    // Call backend API to upsert installation details using App credentials
    fetch(`/api/company/github-setup/callback?installation_id=${installationId}&setup_action=${setupAction || 'install'}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          router.push('/company/overview?success=GitHub+App+installation+connected+successfully!');
        } else {
          setError(data.error || 'Failed to link GitHub App installation.');
        }
      })
      .catch((err) => {
        console.error(err);
        setError('Network error occurred while connecting installation.');
      });
  }, [searchParams, router]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-8 animate-fade-in flex flex-col items-center">
      {error ? (
        <>
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2">Integration Failed</h2>
          <p className="text-xs text-rose-500 font-semibold mb-6">{error}</p>
          <button
            onClick={() => router.push('/company/github-setup')}
            className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
          >
            Retry Setup
          </button>
        </>
      ) : (
        <>
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand/20 border-b-brand mb-4"></div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Linking GitHub App...</h2>
          <p className="text-[11px] text-slate-400 font-semibold mt-1">Please wait while we register your organization credentials.</p>
        </>
      )}
    </div>
  );
}

export default function GitHubSetupCallbackPage() {
  return (
    <div className="w-full max-w-md mx-auto py-20 px-4 text-center">
      <Suspense fallback={
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl p-8 flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-brand/20 border-b-brand mb-4"></div>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Loading callback details...</h2>
        </div>
      }>
        <CallbackHandler />
      </Suspense>
    </div>
  );
}
