'use strict';
'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function SuccessHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      
      // Verification call to resolve landing redirection
      fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.user) {
            const { role } = data.user;
            if (role === 'admin') {
              router.push('/admin');
            } else if (role === 'company_admin' || role === 'company_employee') {
              router.push('/company');
            } else {
              router.push('/dashboard');
            }
          } else {
            router.push('/dashboard');
          }
        })
        .catch(err => {
          console.error(err);
          router.push('/dashboard');
        });
    } else {
      router.push('/');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand mb-4"></div>
      <p className="text-slate-600 font-medium">Completing secure sign-in, please wait...</p>
    </div>
  );
}

export default function OAuthSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">Loading auth context...</p>
      </div>
    }>
      <SuccessHandler />
    </Suspense>
  );
}
