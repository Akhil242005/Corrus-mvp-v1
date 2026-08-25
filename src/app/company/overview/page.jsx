'use client';

import { useContext, useEffect } from 'react';
import { CompanyContext } from '../layout';
import { getCanonicalId } from '@/lib/idMapper';
import { useRouter } from 'next/navigation';

export default function WorkspaceOverview() {
  const router = useRouter();
  const { company, employees, competitions, githubAppInstalled, githubInstallation, userRole, token, fetchDashboardData } = useContext(CompanyContext);

  useEffect(() => {
    if (token) {
      fetchDashboardData(token);
    }
  }, [token]);

  const creatorIdStr = company.adminId ? getCanonicalId('admin', company.adminId.id || 1) : '';
  const adminInitials = company.adminId ? `${company.adminId.firstname[0]}${company.adminId.lastname ? company.adminId.lastname[0] : ''}`.toUpperCase() : 'A';

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {!githubAppInstalled && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
          <div className="flex items-start gap-2.5">
            <span className="text-lg">⚠️</span>
            <div>
              <p className="font-extrabold text-amber-800">GitHub App Integration Required</p>
              <p className="text-slate-500 font-semibold mt-0.5">Please install the Corrus GitHub App to create coding challenges and receive candidate repository commits.</p>
            </div>
          </div>
          {userRole === 'company_admin' && (
            <button
              onClick={() => router.push('/company/github-setup')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow transition cursor-pointer whitespace-nowrap self-start sm:self-center"
            >
              Configure Setup
            </button>
          )}
        </div>
      )}

      {/* Workspace Header Banner */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-[-100px] right-[-100px] w-56 h-56 rounded-full bg-brand/5 blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex flex-wrap items-center gap-3">
            <span>{company.name}</span>
            <span className={`text-[10px] font-black border px-2.5 py-1 rounded-full uppercase tracking-wider ${
              company.isVerified
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
                : 'bg-amber-55/10 text-amber-600 border-amber-200/60'
            }`}>
              {company.isVerified ? '✓ Verified Workspace' : '⌛ Pending Verification'}
            </span>
          </h1>
          <p className="text-sm font-semibold text-slate-400 mt-1.5 flex items-center gap-2">
            <span>📍 {company.place}</span>
            {company.website && (
              <>
                <span className="text-slate-200">•</span>
                <a href={company.website} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                  🔗 {company.website.replace(/^https?:\/\//, '')}
                </a>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workspace Description & Stats Grid */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Workspace Description */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-3">
            <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2.5">
              Workspace Profile Overview
            </h3>
            <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">
              {company.description || 'Provide an enterprise overview inside workspace portal settings.'}
            </p>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm text-center flex flex-col items-center justify-center gap-1 transition-all hover:border-brand/35 cursor-default">
              <span className="text-3xl font-black text-brand tracking-tight">{competitions.length}</span>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Challenges</p>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm text-center flex flex-col items-center justify-center gap-1 transition-all hover:border-brand/35 cursor-default">
              <span className="text-3xl font-black text-brand tracking-tight">{employees.length + 1}</span>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Workspace Users</p>
            </div>
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm text-center flex flex-col items-center justify-center gap-1 transition-all hover:border-brand/35 cursor-default">
              <span className={`text-sm font-black uppercase tracking-wider ${company.isVerified ? 'text-emerald-500' : 'text-amber-500'}`}>
                {company.isVerified ? 'Verified' : 'Pending'}
              </span>
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Status</p>
            </div>
          </div>
        </div>

        {/* Sidebar Cards Stack */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Workspace Admin Representative Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-5 relative overflow-hidden">
            <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2.5">
              Console Administrator
            </h3>
            
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-brand-light text-brand flex items-center justify-center font-black text-sm border border-brand/20 shadow-inner">
                {adminInitials}
              </div>
              <div className="flex flex-col">
                <p className="text-sm font-black text-slate-900 leading-tight">
                  {company.adminId.firstname} {company.adminId.lastname}
                </p>
                <p className="text-[11px] font-semibold text-slate-400 leading-normal mt-0.5">
                  {company.adminId.email}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 flex flex-col gap-1.5 text-xs text-slate-600">
              {creatorIdStr && (
                <p className="flex justify-between">
                  <span className="font-bold text-slate-400">ID:</span>
                  <span className="font-mono font-bold text-slate-800">{creatorIdStr}</span>
                </p>
              )}
              <p className="flex justify-between">
                <span className="font-bold text-slate-400">Role Authority:</span>
                <span className="font-bold text-brand uppercase text-[10px] tracking-wider">Company Admin</span>
              </p>
            </div>
          </div>

          {/* GitHub Integration Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-5 relative overflow-hidden">
            <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2.5">
              GitHub Integration
            </h3>
            
            {githubAppInstalled && githubInstallation ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-lg border border-emerald-200 shadow-inner">
                    🐙
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-black text-slate-900 leading-tight">
                      {githubInstallation.orgLogin}
                    </p>
                    <p className="text-[11px] font-bold text-emerald-600 leading-normal mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                      App Connected
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 flex flex-col gap-1.5 text-xs text-slate-600">
                  <p className="flex justify-between">
                    <span className="font-bold text-slate-400">Org Login:</span>
                    <span className="font-bold text-slate-800">{githubInstallation.orgLogin}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="font-bold text-slate-400">Installation ID:</span>
                    <span className="font-mono font-bold text-slate-800">{githubInstallation.installationId}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="font-bold text-slate-400">Connected:</span>
                    <span className="font-bold text-slate-800">{new Date(githubInstallation.installedAt).toLocaleDateString()}</span>
                  </p>
                </div>

                <a
                  href={`https://github.com/${githubInstallation.orgLogin}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-2.5 bg-brand hover:bg-brand-hover text-white text-center text-xs font-bold rounded-xl transition cursor-pointer shadow-sm shadow-brand/10 border border-brand/25"
                >
                  Open GitHub Organization
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center font-black text-lg border border-rose-200 shadow-inner">
                    🚫
                  </div>
                  <div className="flex flex-col">
                    <p className="text-sm font-black text-slate-900 leading-tight">
                      Not Configured
                    </p>
                    <p className="text-[11px] font-bold text-rose-600 leading-normal mt-0.5 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block"></span>
                      App Disconnected
                    </p>
                  </div>
                </div>

                <p className="text-slate-500 text-xs leading-relaxed">
                  Connect your GitHub organization to build sandbox-compatible repositories and automate evaluations.
                </p>

                {userRole === 'company_admin' && (
                  <button
                    onClick={() => router.push('/company/github-setup')}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-center text-xs font-bold rounded-xl transition cursor-pointer border border-slate-200/80"
                  >
                    Configure GitHub App
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
