'use client';

import { useContext, useState, useEffect } from 'react';
import { CompanyContext } from '../layout';
import SearchFilterBar from '@/components/SearchFilterBar';
import Pagination from '@/components/Pagination';
import Link from 'next/link';

export default function CompanySubmissionsLevel1() {
  const { competitions, loading } = useContext(CompanyContext);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // Grid layout fits 6 cards beautifully

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Client-side filtering by competition title or tech stack details
  const filteredComps = competitions.filter(comp => {
    const query = searchQuery.toLowerCase();
    return (
      query === '' ||
      comp.title.toLowerCase().includes(query) ||
      comp.language.toLowerCase().includes(query)
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentComps = filteredComps.slice(indexOfFirstItem, indexOfLastItem);

  const getDeadlineStatus = (comp) => {
    if (!comp.submissionDeadline) {
      return { label: 'No Deadline Set', color: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
    const deadline = new Date(comp.submissionDeadline);
    const now = new Date();
    if (deadline < now) {
      return { label: 'Closed', color: 'bg-rose-50 text-rose-600 border-rose-200' };
    }
    return {
      label: `Open until ${deadline.toLocaleDateString()} ${deadline.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      color: 'bg-emerald-50 text-emerald-600 border-emerald-200'
    };
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Hiring Sandbox Submissions</h1>
        <p className="text-xs font-semibold text-slate-400 mt-1">
          Select a competition challenge to review leaderboard rankings, code files, and sandbox test logs.
        </p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by competition title or coding language..."
        filters={[]}
        onClear={() => setSearchQuery('')}
      />

      {loading ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-2"></div>
          <span className="text-xs text-slate-400 font-semibold">Loading competitions...</span>
        </div>
      ) : (
        <>
          {filteredComps.length === 0 ? (
            <div className="w-full bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-sm">
              <p className="text-slate-400 text-sm font-semibold">No competitions match your search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentComps.map((comp) => {
                const deadlineStatus = getDeadlineStatus(comp);
                return (
                  <Link
                    href={`/company/submissions/${comp.id}`}
                    key={comp.id}
                    className="group bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 cursor-pointer"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-base font-bold text-slate-950 group-hover:text-brand transition leading-tight line-clamp-1">
                          {comp.title}
                        </h3>
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-brand-light text-brand px-2 py-0.5 rounded-full shrink-0 border border-brand/5">
                          {comp.language}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 mt-4 text-xs font-semibold text-slate-600">
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <span className="text-slate-400 font-medium">Candidates Enrolled</span>
                          <span className="text-slate-800 font-bold">{comp.enrolledCount}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <span className="text-slate-400 font-medium">Solutions Submitted</span>
                          <span className="text-slate-800 font-bold">{comp.submissionCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 border-t border-slate-100 pt-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Deadline Rule:</span>
                        <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${deadlineStatus.color}`}>
                          {deadlineStatus.label}
                        </span>
                      </div>
                      
                      {comp.autoCloseEnabled && (
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                          <span>Auto-Close Push Permissions</span>
                          <span className="text-emerald-600 font-bold">Enabled</span>
                        </div>
                      )}

                      <div className="flex justify-end mt-2">
                        <span className="text-[10px] font-extrabold text-brand group-hover:underline flex items-center gap-1">
                          View Leaderboard & Submissions →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <Pagination
            currentPage={currentPage}
            totalItems={filteredComps.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
      )}
    </div>
  );
}
