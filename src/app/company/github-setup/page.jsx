'use client';

import { useContext, useState, useEffect } from 'react';
import { CompanyContext } from '../layout';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function GitHubSetupPage() {
  const { company, token, githubAppInstalled, fetchDashboardData } = useContext(CompanyContext);
  const router = useRouter();

  const appSlug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'corrus-hiring';
  const installationUrl = `https://github.com/apps/${appSlug}/installations/new`;

  // Local step tracking states
  const [hasCreatedOrg, setHasCreatedOrg] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifError, setVerifError] = useState('');
  const [verifSuccess, setVerifSuccess] = useState('');

  // Manual linking states
  const [manualOrg, setManualOrg] = useState('');
  const [manualId, setManualId] = useState('');
  const [manualLinking, setManualLinking] = useState(false);
  const [manualError, setManualError] = useState('');

  // Background polling to detect installation automatically
  useEffect(() => {
    if (!token || githubAppInstalled) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/company/dashboard', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.githubAppInstalled) {
            setVerifSuccess('GitHub App installation connected successfully! All steps completed.');
            setVerifError('');
            await fetchDashboardData(token); // refresh parent context state
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error('Background installation check error:', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [token, githubAppInstalled]);

  // Determine completion of individual steps
  const step1Completed = hasCreatedOrg || githubAppInstalled;
  const step2Completed = githubAppInstalled;
  const step3Completed = githubAppInstalled;

  const handleVerifyConnection = async () => {
    setVerifError('');
    setVerifSuccess('');
    setVerifying(true);

    try {
      await fetchDashboardData(token);
      
      const res = await fetch('/api/company/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to retrieve verification status');
      const data = await res.json();

      if (data.githubAppInstalled) {
        setVerifSuccess('GitHub App installation connected successfully! Redirecting...');
        setTimeout(() => {
          router.push('/company/overview?success=Connected');
        }, 1500);
      } else {
        setVerifError('We could not detect the GitHub App installation yet. Please ensure you completed Step 2 on GitHub first, or try again.');
      }
    } catch (err) {
      console.error(err);
      setVerifError('Failed to contact verification API. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleManualLink = async () => {
    setManualError('');
    setManualLinking(true);

    try {
      const res = await fetch(`/api/company/github-setup/callback?installation_id=${manualId.trim()}&org_login=${manualOrg.trim()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setVerifSuccess('GitHub App installation connected manually!');
        await fetchDashboardData(token); // refresh context
      } else {
        setManualError(data.error || 'Failed to link manual integration.');
      }
    } catch (err) {
      console.error(err);
      setManualError('Network error occurred during manual verification.');
    } finally {
      setManualLinking(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-10 px-4">
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xl p-8 md:p-10 animate-fade-in flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
          <div className="text-3xl">🤖</div>
          <div className="flex-1">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">GitHub App Integration Setup</h1>
            <p className="text-xs font-semibold text-slate-400 mt-1">Configure your corporate sandbox environment to dispatch challenges.</p>
          </div>
          {githubAppInstalled && (
            <span className="bg-emerald-50 border border-emerald-200 text-emerald-600 text-[10px] font-black uppercase px-2.5 py-1 rounded-full tracking-wider animate-pulse">
              ✓ Connected
            </span>
          )}
        </div>

        {/* Info Alert Box */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 leading-relaxed">
          <p className="font-bold text-slate-800 mb-1">Why is this required?</p>
          CORRUS coordinates candidate assessment tasks by dynamically generating secure sandbox repositories, managing user access roles, and polling push event commits via webhook automation.
        </div>

        {/* Step List */}
        <div className="flex flex-col gap-6 text-xs text-slate-700">
          
          {/* Step 1 */}
          <div className="flex items-start gap-4">
            <div className={`w-7 h-7 rounded-full border flex items-center justify-center font-extrabold shrink-0 mt-0.5 transition-all duration-300 ${
              step1Completed 
                ? 'bg-emerald-500 border-emerald-500 text-white' 
                : 'bg-brand border-brand text-white'
            }`}>
              {step1Completed ? '✓' : '1'}
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  Create a Dedicated GitHub Organization
                  {step1Completed && <span className="text-emerald-500 text-xs font-bold">Done</span>}
                </h3>
                <p className="text-slate-500 mt-1 leading-relaxed">
                  We strongly recommend creating a dedicated hiring organization (e.g. <span className="font-mono bg-slate-50 border border-slate-200 px-1 py-0.5 rounded text-brand">{company?.name ? `${company.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-hiring` : 'yourcompany-hiring'}</span>) to keep sandboxes completely isolated.
                </p>
              </div>
              <a
                href="https://github.com/organizations/new"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setHasCreatedOrg(true)}
                className="inline-flex items-center gap-1.5 font-bold text-brand hover:underline cursor-pointer"
              >
                <span>➕</span> Create GitHub Organization &rarr;
              </a>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-start gap-4 border-t border-slate-100 pt-5">
            <div className={`w-7 h-7 rounded-full border flex items-center justify-center font-extrabold shrink-0 mt-0.5 transition-all duration-300 ${
              step2Completed 
                ? 'bg-emerald-500 border-emerald-500 text-white' 
                : step1Completed
                  ? 'bg-brand border-brand text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
            }`}>
              {step2Completed ? '✓' : '2'}
            </div>
            <div className="flex flex-col gap-2">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  Install the Corrus GitHub App
                  {step2Completed && <span className="text-emerald-500 text-xs font-bold">Done</span>}
                </h3>
                <p className="text-slate-500 mt-1 leading-relaxed">
                  Install our app into your new hiring organization. This permits CORRUS to provision private assessment repositories for candidate enrollments.
                </p>
              </div>
              <div>
                <a
                  href={installationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-md transition cursor-pointer inline-flex items-center gap-1.5 ${
                    step1Completed
                      ? 'bg-brand hover:bg-brand-hover text-white'
                      : 'bg-slate-105 border border-slate-200 text-slate-400 cursor-not-allowed pointer-events-none'
                  }`}
                >
                  <span>🤖</span> Install Corrus App
                </a>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-start gap-4 border-t border-slate-100 pt-5">
            <div className={`w-7 h-7 rounded-full border flex items-center justify-center font-extrabold shrink-0 mt-0.5 transition-all duration-300 ${
              step3Completed 
                ? 'bg-emerald-500 border-emerald-500 text-white' 
                : step2Completed
                  ? 'bg-brand border-brand text-white'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
            }`}>
              {step3Completed ? '✓' : '3'}
            </div>
            <div className="flex flex-col gap-2.5 w-full">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                  Confirm App Connection Status
                  {step3Completed && <span className="text-emerald-500 text-xs font-bold">Done</span>}
                </h3>
                <p className="text-slate-500 mt-1 leading-relaxed">
                  After installing the app on GitHub, click the button below to verify the active connection before proceeding.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleVerifyConnection}
                  disabled={verifying || !step1Completed}
                  className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5 self-start disabled:opacity-50 ${
                    step1Completed
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-slate-105 border border-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {verifying ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/30 border-b-white"></div>
                      Verifying Connection...
                    </>
                  ) : (
                    <>
                      <span>🔍</span> Verify App Connection
                    </>
                  )}
                </button>

                {verifError && (
                  <p className="text-xs font-bold text-rose-500 bg-rose-50 border border-rose-100 px-3 py-2 rounded-lg leading-relaxed flex items-center gap-2 animate-fade-in">
                    <span>⚠️</span> {verifError}
                  </p>
                )}
                {verifSuccess && (
                  <p className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-lg leading-relaxed flex items-center gap-2 animate-fade-in">
                    <span>✓</span> {verifSuccess}
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Manual Linking Option */}
        <div className="border-t border-slate-100 pt-5 text-xs">
          <details className="group cursor-pointer">
            <summary className="font-bold text-slate-400 hover:text-slate-600 transition flex items-center gap-1.5">
              <span>🔧</span> Trouble connecting? Link organization manually
            </summary>
            <div className="mt-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col gap-3 cursor-default">
              <p className="text-slate-500 font-semibold leading-relaxed">
                If GitHub was unable to redirect to localhost, or if your local server does not have webhook forwarding configured, you can link the installation manually.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">GitHub Org Name</label>
                  <input
                    type="text"
                    value={manualOrg}
                    onChange={(e) => setManualOrg(e.target.value)}
                    placeholder="e.g. yourcompany-hiring"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700">Installation ID</label>
                  <input
                    type="text"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    placeholder="e.g. 52345678"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleManualLink}
                disabled={manualLinking || !manualOrg || !manualId}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg transition self-start disabled:opacity-50 cursor-pointer"
              >
                {manualLinking ? 'Linking...' : 'Link Connection Manually'}
              </button>

              {manualError && (
                <p className="text-xs font-bold text-rose-500 leading-normal mt-1 animate-fade-in">
                  ⚠️ {manualError}
                </p>
              )}
            </div>
          </details>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-5">
          <Link
            href="/company/overview"
            className="text-xs font-bold text-slate-400 hover:text-slate-700 transition"
          >
            &larr; Skip for now, go to dashboard
          </Link>
          
          <button
            onClick={() => router.push('/company/overview')}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-sm transition cursor-pointer ${
              githubAppInstalled
                ? 'bg-brand hover:bg-brand-hover text-white'
                : 'bg-slate-100 hover:bg-slate-250 border border-slate-200 text-slate-700'
            }`}
          >
            {githubAppInstalled ? 'Finish & Go to Dashboard &rarr;' : 'Go to Dashboard'}
          </button>
        </div>

      </div>
    </div>
  );
}
