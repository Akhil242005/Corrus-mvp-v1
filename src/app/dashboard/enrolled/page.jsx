'use client';

import { useContext, useState, useEffect } from 'react';
import { CandidateContext } from '../layout';
import CanonicalTag from '@/components/CanonicalTag';
import SearchFilterBar from '@/components/SearchFilterBar';
import { getCanonicalId } from '@/lib/idMapper';
import Pagination from '@/components/Pagination';

export default function EnrolledCompetitions() {
  const { user, competitions } = useContext(CandidateContext);

  const [searchQuery, setSearchQuery] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // Grid displays 6 cards per page nicely

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Selected Competition Details modal
  const [selectedComp, setSelectedComp] = useState(null);

  // Filter only competitions where the user is enrolled
  const enrolledCompetitions = competitions.filter(
    (c) => c.enrolledUsers?.includes(user?.id) || false
  );

  // Filter based on search criteria client-side
  const filteredEnrolled = enrolledCompetitions.filter((c) => {
    const challengeIdStr = getCanonicalId('challenge', c.id);
    const enrollmentIdStr = getCanonicalId('enrollment', `${c.id}-${user.id}`);
    
    return (
      searchQuery === '' ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.companyId?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      challengeIdStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enrollmentIdStr.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEnrolled = filteredEnrolled.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 capitalize">My Enrollments</h1>
        <p className="text-sm text-slate-500">Trace your registered hiring challenges, sandbox status, and solutions.</p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search enrolled challenges by title, company, Challenge ID or Enrollment ID..."
        filters={[]}
        onClear={() => setSearchQuery('')}
      />

      {filteredEnrolled.length === 0 ? (
        <div className="w-full bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <p className="text-slate-400 text-lg font-medium">No enrollments match the filter.</p>
          <p className="text-sm text-slate-400 mt-1">Explore and enroll in platform challenges to begin verification.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentEnrolled.map((c) => {
              const enrollId = `${c.id}-${user.id}`;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedComp(c)}
                  className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-1 transition duration-200 cursor-pointer"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-lg font-bold text-brand leading-tight line-clamp-1">
                        {c.title}
                      </h3>
                      <span className="text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                        Active
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mb-3">
                      By <span className="font-semibold text-slate-700">{c.companyId?.name}</span>
                    </p>

                    <p className="text-sm text-slate-600 line-clamp-3 mb-4">
                      {c.taskDescription}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400 uppercase text-[9px]">Challenge ID:</span>
                      <CanonicalTag type="challenge" id={c.id} />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-400 uppercase text-[9px]">Enrollment ID:</span>
                      <CanonicalTag type="enrollment" id={enrollId} />
                    </div>
                    <div className="flex items-center justify-between mt-2 border-t border-slate-50 pt-2">
                      <span className="text-xs font-semibold text-slate-600">🕒 {c.experienceRequired} exp</span>
                      {c.enrolledRepoUrl ? (
                        <a
                          href={c.enrolledRepoUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-bold text-brand hover:text-brand-hover flex items-center gap-1 hover:underline"
                        >
                          🐙 Open Repository
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 font-semibold italic">
                          No Repo Cloned
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredEnrolled.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Detail Modal */}
      {selectedComp && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setSelectedComp(null)}>
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl p-8 w-full max-w-2xl relative animate-modal" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedComp(null)} className="absolute top-4 right-5 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <h2 className="text-2xl font-bold text-brand mb-2">{selectedComp.title}</h2>
            <div className="flex flex-col gap-1.5 mb-6 border-b border-slate-100 pb-4">
              <p className="text-xs text-slate-500">
                Published by <span className="font-semibold">{selectedComp.companyId?.name}</span>
              </p>
              <div className="flex gap-4 mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Challenge ID:</span>
                  <CanonicalTag type="challenge" id={selectedComp.id} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Enrollment ID:</span>
                  <CanonicalTag type="enrollment" id={`${selectedComp.id}-${user.id}`} />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 text-sm text-slate-700 mb-6">
              <div>
                <strong className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Challenge Instructions Brief</strong>
                <p className="leading-relaxed bg-slate-50 border border-slate-200 p-4 rounded-lg whitespace-pre-wrap">
                  {selectedComp.taskDescription}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Required Skills</strong>
                  <p className="font-semibold text-slate-800">
                    {selectedComp.skillsRequired.join(', ') || 'N/A'}
                  </p>
                </div>
                <div>
                  <strong className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Experience Level</strong>
                  <p className="font-semibold text-slate-800">
                    {selectedComp.experienceRequired}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
              {selectedComp.enrolledRepoUrl ? (
                <a
                  href={selectedComp.enrolledRepoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm shadow-brand/10 border border-brand/25"
                >
                  🐙 Open Repository
                </a>
              ) : (
                <div />
              )}
              <button
                onClick={() => setSelectedComp(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
