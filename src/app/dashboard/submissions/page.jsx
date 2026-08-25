'use client';

import { useContext, useState, useEffect } from 'react';
import { CandidateContext } from '../layout';
import CanonicalTag from '@/components/CanonicalTag';
import SearchFilterBar from '@/components/SearchFilterBar';
import { getCanonicalId } from '@/lib/idMapper';
import Pagination from '@/components/Pagination';

export default function CandidateSubmissions() {
  const { user, token } = useContext(CandidateContext);

  const [submissionsList, setSubmissionsList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSub, setSelectedSub] = useState(null);
  const [selectedFilters, setSelectedFilters] = useState({ company: [], status: [] });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilters]);

  // Fetch actual submissions
  useEffect(() => {
    const fetchSubmissions = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch('/api/submissions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSubmissionsList(data);
        }
      } catch (err) {
        console.error('Failed to load candidate submissions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSubmissions();
  }, [token]);

  const uniqueCompanies = [];
  submissionsList.forEach(sub => {
    if (sub.companyName && !uniqueCompanies.includes(sub.companyName)) {
      uniqueCompanies.push(sub.companyName);
    }
  });

  const categories = [
    {
      key: 'company',
      label: 'Filter by Company',
      options: uniqueCompanies.map((c) => ({ value: c, label: c }))
    },
    {
      key: 'status',
      label: 'Filter by Status',
      options: [
        { value: 'PENDING', label: 'PENDING' },
        { value: 'PROCESSING', label: 'PROCESSING' },
        { value: 'Graded', label: 'Graded' },
        { value: 'FAILED', label: 'FAILED' }
      ]
    }
  ];

  // Filter submissions list client-side
  const filteredSubs = submissionsList.filter((sub) => {
    const enrollmentIdStr = getCanonicalId('enrollment', `${sub.competitionId}-${user.id}`);
    const submissionIdStr = getCanonicalId('submission', sub.id);
    
    const matchesSearch =
      searchQuery === '' ||
      sub.challengeTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      enrollmentIdStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submissionIdStr.toLowerCase().includes(searchQuery.toLowerCase());

    const selectedCompanies = selectedFilters.company || [];
    const matchesCompany = selectedCompanies.length === 0 || selectedCompanies.includes(sub.companyName);

    const selectedStatuses = selectedFilters.status || [];
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(sub.status);

    return matchesSearch && matchesCompany && matchesStatus;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSubs = filteredSubs.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 capitalize">My Submissions</h1>
        <p className="text-sm text-slate-500">View code evaluation feedback, scores, and sandboxed test logs.</p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search submissions by title, company, Enrollment ID or Submission ID..."
        categories={categories}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
        onClear={() => {
          setSearchQuery('');
          setSelectedFilters({ company: [], status: [] });
        }}
      />

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center shadow-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-2"></div>
          <span className="text-xs text-slate-400 font-semibold">Loading submissions history...</span>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                <th className="p-4 font-bold">Submission ID</th>
                <th className="p-4 font-bold">Enrollment ID</th>
                <th className="p-4 font-bold">Challenge Title</th>
                <th className="p-4 font-bold">Workspace</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentSubs.map((sub) => (
                <tr key={sub.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4">
                    <CanonicalTag type="submission" id={sub.id} />
                  </td>
                  <td className="p-4">
                    <CanonicalTag type="enrollment" id={`${sub.competitionId}-${user.id}`} />
                  </td>
                  <td className="p-4 font-bold text-brand">{sub.challengeTitle}</td>
                  <td className="p-4 text-slate-600 font-semibold">{sub.companyName}</td>
                  <td className="p-4">
                    <span className={`text-[11px] font-extrabold border px-2 py-0.5 rounded-full select-none ${
                      sub.status === 'Graded'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : sub.status === 'PENDING'
                        ? 'bg-blue-50 text-blue-600 border-blue-200'
                        : sub.status === 'PROCESSING'
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : sub.status === 'FAILED'
                        ? 'bg-rose-50 text-rose-600 border-rose-200'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}>
                      {sub.status} {sub.score !== null ? `(${sub.score}%)` : ''}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedSub(sub)}
                      className="px-3 py-1 bg-brand/10 hover:bg-brand/15 text-brand text-xs font-bold rounded-lg transition cursor-pointer"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
              {filteredSubs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                    No active submissions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        currentPage={currentPage}
        totalItems={filteredSubs.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* Details Modal */}
      {selectedSub && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setSelectedSub(null)}>
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl p-6 w-full max-w-2xl relative animate-modal" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedSub(null)} className="absolute top-3 right-4 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-xl font-bold text-slate-900">
                Sandbox Submission Details
              </h2>
              <p className="text-sm font-mono text-slate-500 mt-1">
                Submission ID: <span className="font-bold text-brand">{getCanonicalId('submission', selectedSub.id)}</span>
              </p>
            </div>

            <div className="flex flex-col gap-4 text-sm text-slate-700 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong className="text-xs text-slate-400 uppercase font-bold">Challenge</strong>
                  <p className="font-semibold">{selectedSub.challengeTitle}</p>
                </div>
                <div>
                  <strong className="text-xs text-slate-400 uppercase font-bold">Workspace</strong>
                  <p className="font-semibold">{selectedSub.companyName}</p>
                </div>
              </div>

              <div>
                <strong className="text-xs text-slate-400 uppercase font-bold">Sandbox Repository</strong>
                <p className="font-mono text-xs text-brand font-bold bg-slate-50 border border-slate-200 p-2.5 rounded mt-1 overflow-x-auto">
                  {selectedSub.repoUrl}
                </p>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                <strong className="text-xs text-slate-400 uppercase font-bold">Sandbox Build Output Logs</strong>
                <div className="font-mono text-[11px] text-slate-600 mt-2 flex flex-col gap-1 max-h-[160px] overflow-y-auto">
                  {selectedSub.attributes?.logs ? (
                    <pre className="whitespace-pre-wrap">{selectedSub.attributes.logs}</pre>
                  ) : selectedSub.status === 'Graded' ? (
                    <>
                      <p className="text-emerald-600">✔ All unit tests passed</p>
                      <p className="text-emerald-600">✔ Build compiler succeeded</p>
                      {selectedSub.attributes?.coverage && <p className="text-slate-400">✔ Code coverage: {selectedSub.attributes.coverage}%</p>}
                    </>
                  ) : selectedSub.status === 'FAILED' ? (
                    <p className="text-rose-600">✖ Sandbox compilation or testing phase failed</p>
                  ) : (
                    <p className="text-slate-400">🕒 Sandbox test runner is pending build dispatch...</p>
                  )}
                </div>
              </div>

              {selectedSub.status === 'Graded' && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg">
                  <p className="text-sm font-bold text-emerald-700">Evaluation Grade: {selectedSub.score}% (Passed)</p>
                  {selectedSub.reasons && selectedSub.reasons.length > 0 && (
                    <div className="mt-2 text-xs text-emerald-600">
                      <strong>Key Highlights:</strong>
                      <ul className="list-disc pl-4 mt-1 flex flex-col gap-0.5">
                        {selectedSub.reasons.map((r, idx) => (
                          <li key={idx}>"{r}"</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {selectedSub.status === 'FAILED' && selectedSub.errorMessage && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-lg">
                  <p className="text-sm font-bold text-rose-700">Evaluation Failure Message</p>
                  <p className="text-xs text-rose-600 mt-1 font-semibold">"{selectedSub.errorMessage}"</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <button
                onClick={() => setSelectedSub(null)}
                className="px-5 py-2.5 bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg cursor-pointer"
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
