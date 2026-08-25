'use client';

import { useContext, useState, useEffect } from 'react';
import { CompanyContext } from '../layout';
import CanonicalTag from '@/components/CanonicalTag';
import SearchFilterBar from '@/components/SearchFilterBar';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getCanonicalId } from '@/lib/idMapper';
import Pagination from '@/components/Pagination';

export default function CompanySubmissions() {
  const { competitions, token } = useContext(CompanyContext);

  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ status: [] });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilters]);

  const categories = [
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

  // Selected Submission Modal state
  const [selectedSub, setSelectedSub] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Grade action state
  const [isGrading, setIsGrading] = useState(false);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');

  // Confirmation state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionConfirmDetails, setActionConfirmDetails] = useState(null);

  // Fetch actual company submissions
  useEffect(() => {
    const loadSubmissions = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch('/api/company/submissions', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setSubmissions(data);
        }
      } catch (err) {
        console.error('Failed to load submissions:', err);
      } finally {
        setLoading(false);
      }
    };
    loadSubmissions();
  }, [token]);

  const handleGradeSubmit = (e) => {
    e.preventDefault();
    if (!gradeScore || isNaN(gradeScore)) {
      alert('Please enter a valid numeric score');
      return;
    }
    
    // Update locally in state
    setSubmissions(prev => prev.map(sub => {
      if (sub.id === selectedSub.id) {
        return {
          ...sub,
          status: 'Graded',
          score: parseInt(gradeScore, 10),
          feedback: gradeFeedback
        };
      }
      return sub;
    }));

    // Reset modals
    setIsGrading(false);
    setIsModalOpen(false);
    setSelectedSub(null);
  };

  const triggerActionConfirm = (actionType) => {
    setActionConfirmDetails({
      type: actionType,
      title: actionType === 'approve' ? 'Approve Solution' : 'Reject Submission',
      consequence: actionType === 'approve' 
        ? 'This will immediately certify their code and publish results to the candidate Track Record.'
        : 'This will reject the candidate code submission and notify them of revision comments.'
    });
    setConfirmOpen(true);
  };

  const handleExecuteSubAction = () => {
    if (!actionConfirmDetails || !selectedSub) return;
    const isApprove = actionConfirmDetails.type === 'approve';
    
    setSubmissions(prev => prev.map(sub => {
      if (sub.id === selectedSub.id) {
        return {
          ...sub,
          status: isApprove ? 'Graded' : 'Rejected',
          score: isApprove ? 90 : 0,
          feedback: isApprove ? 'Approved code check.' : 'Code rejected due to build compilation failure.'
        };
      }
      return sub;
    }));

    setIsModalOpen(false);
    setSelectedSub(null);
  };

  // Filter client-side
  const filteredSubs = submissions.filter(sub => {
    const candidateIdStr = getCanonicalId('candidate', sub.candidateId);
    const submissionIdStr = getCanonicalId('submission', sub.id);
    const matchesSearch =
      searchQuery === '' ||
      sub.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.challengeTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidateIdStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submissionIdStr.toLowerCase().includes(searchQuery.toLowerCase());

    const selectedStatuses = selectedFilters.status || [];
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(sub.status);

    return matchesSearch && matchesStatus;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSubs = filteredSubs.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Submissions Review</h1>
        <p className="text-xs font-semibold text-slate-400 mt-1">Audit coding sandboxes, check test coverages, and grade candidate submissions.</p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by candidate name, challenge title, Submission ID, or Candidate ID (e.g. SUB-0001)..."
        categories={categories}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
        onClear={() => {
          setSearchQuery('');
          setSelectedFilters({ status: [] });
        }}
      />

      {loading ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-2"></div>
          <span className="text-xs text-slate-400 font-semibold">Loading submissions log...</span>
        </div>
      ) : (
        <>
          {/* Table Container */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    <th className="p-4 pl-6">Submission ID</th>
                    <th className="p-4">Candidate ID</th>
                    <th className="p-4">Candidate Name</th>
                    <th className="p-4">Challenge Title</th>
                    <th className="p-4">Submitted Date</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentSubs.map((sub) => (
                    <tr key={sub.id} className="interactive-row hover:bg-slate-50/50">
                      <td className="p-4 pl-6">
                        <CanonicalTag type="submission" id={sub.id} />
                      </td>
                      <td className="p-4">
                        <CanonicalTag type="candidate" id={sub.candidateId} />
                      </td>
                      <td className="p-4 font-black text-slate-900 text-sm">{sub.candidateName}</td>
                      <td className="p-4 text-slate-500 font-semibold">{sub.challengeTitle}</td>
                      <td className="p-4 text-slate-400 font-medium">
                        {new Date(sub.submittedAt).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <span className={`text-[10px] font-extrabold border px-2.5 py-0.5 rounded-full select-none ${
                          sub.status === 'Graded'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
                            : sub.status === 'PENDING'
                            ? 'bg-blue-55/10 text-blue-600 border-blue-200/60'
                            : sub.status === 'PROCESSING'
                            ? 'bg-amber-55/10 text-amber-600 border-amber-200/60'
                            : sub.status === 'FAILED'
                            ? 'bg-rose-50 text-rose-600 border-rose-200/60'
                            : 'bg-slate-50 text-slate-650 border-slate-200/60'
                        }`}>
                          {sub.status} {sub.score !== null ? `(${sub.score}%)` : ''}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <button
                          onClick={() => {
                            setSelectedSub(sub);
                            setIsModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 bg-brand-light border border-brand/10 hover:bg-brand/15 text-brand text-[10px] font-black rounded-lg transition cursor-pointer"
                        >
                          Review & Grade
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredSubs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-400 font-semibold text-sm">
                        No submissions recorded for active hiring challenges.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination
            currentPage={currentPage}
            totalItems={filteredSubs.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Review Modal */}
      {isModalOpen && selectedSub && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 w-full max-w-2xl relative animate-modal max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900 leading-tight">
                Review Coding Sandbox Solution
              </h2>
              <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1.5">
                <span>Submission ID:</span>
                <span className="font-mono font-bold text-brand">{getCanonicalId('submission', selectedSub.id)}</span>
              </p>
            </div>

            {!isGrading ? (
              <div className="flex flex-col gap-5 text-xs text-slate-700 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl">
                    <strong className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Candidate Details</strong>
                    <p className="font-bold text-slate-800">{selectedSub.candidateName}</p>
                    <p className="text-slate-400 text-[10px] font-semibold mt-0.5">{selectedSub.candidateEmail}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl">
                    <strong className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Published Challenge</strong>
                    <p className="font-bold text-slate-800 truncate">{selectedSub.challengeTitle}</p>
                  </div>
                </div>

                <div>
                  <strong className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1.5">Candidate Repository Link</strong>
                  <p className="font-mono text-[10px] text-slate-800 font-bold bg-slate-50 border border-slate-200 p-3 rounded-xl overflow-x-auto select-all">
                    📁 {selectedSub.repoUrl}
                  </p>
                </div>

                {/* Dark Terminal Logs Box */}
                <div>
                  <strong className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1.5">Sandbox Verification Logs</strong>
                  <div className="bg-slate-950/95 border border-slate-900 rounded-xl p-4 font-mono text-[10px] text-slate-300 flex flex-col gap-1 max-h-[160px] overflow-y-auto leading-normal shadow-inner select-text">
                    {selectedSub.attributes?.logs ? (
                      <pre className="whitespace-pre-wrap">{selectedSub.attributes.logs}</pre>
                    ) : selectedSub.status === 'Graded' ? (
                      <>
                        <p className="text-emerald-500">✔ COMPILER SUCCESS: Build successfully dispatched</p>
                        <p className="text-emerald-500">✔ UNIT TESTS: 12/12 assertions passed successfully</p>
                        {selectedSub.attributes?.coverage && <p className="text-brand-accent">✔ CODE COVERAGE: {selectedSub.attributes.coverage}% statements covered</p>}
                      </>
                    ) : selectedSub.status === 'FAILED' ? (
                      <p className="text-rose-500">✖ BUILD FAILURE: Sandbox compiler check failed</p>
                    ) : (
                      <p className="text-slate-500 animate-pulse">🕒 sandbox dispatcher: awaiting build pipeline dispatch...</p>
                    )}
                  </div>
                </div>

                {selectedSub.status === 'FAILED' && selectedSub.errorMessage && (
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl">
                    <p className="text-xs font-bold text-rose-700 uppercase tracking-wide">Evaluation Failure Details</p>
                    <p className="text-xs text-rose-600 mt-1 font-semibold leading-relaxed">"{selectedSub.errorMessage}"</p>
                  </div>
                )}

                {selectedSub.score !== null && (
                  <div className="bg-emerald-50 border border-emerald-250/60 p-4 rounded-xl">
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Grade Certified: {selectedSub.score}% (Pass)</p>
                    {selectedSub.feedback && <p className="text-[11px] text-emerald-700 mt-1.5 leading-relaxed"><strong>Representative Feedback:</strong> {selectedSub.feedback}</p>}
                  </div>
                )}

                <div className="border-t border-slate-100 pt-4 flex justify-between gap-3 items-center">
                  <div className="flex gap-2">
                    <button
                      onClick={() => triggerActionConfirm('approve')}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                    >
                      Quick Approve (90%)
                    </button>
                    <button
                      onClick={() => triggerActionConfirm('reject')}
                      className="px-4 py-2 bg-rose-55 hover:bg-rose-600 text-white text-[10px] font-bold rounded-lg cursor-pointer"
                    >
                      Reject Solution
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setGradeScore(selectedSub.score || '');
                        setGradeFeedback(selectedSub.feedback || '');
                        setIsGrading(true);
                      }}
                      className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-[10px] font-bold rounded-lg cursor-pointer"
                    >
                      Grade Manually
                    </button>
                    <button
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 text-[10px] font-semibold rounded-lg cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleGradeSubmit} className="flex flex-col gap-4 text-xs text-slate-700">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">Evaluation Score (0-100) *</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Enter competence percentage score"
                    value={gradeScore}
                    onChange={(e) => setGradeScore(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">Revision Comments / Feedback</label>
                  <textarea
                    placeholder="Provide details on algorithm optimizations, architecture constraints, or code comments."
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                    rows={3}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-medium resize-none"
                  />
                </div>
                <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsGrading(false)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-brand hover:bg-brand-hover text-white text-[10px] font-bold rounded-lg cursor-pointer shadow-md shadow-brand/10"
                  >
                    Submit Grade
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmOpen && actionConfirmDetails && (
        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => {
            setConfirmOpen(false);
            setActionConfirmDetails(null);
          }}
          onConfirm={handleExecuteSubAction}
          actionName={actionConfirmDetails.title}
          targetName={selectedSub ? selectedSub.candidateName : ''}
          targetId={selectedSub ? getCanonicalId('submission', selectedSub.id) : ''}
          consequenceText={actionConfirmDetails.consequence}
          isDestructive={actionConfirmDetails.type === 'reject'}
        />
      )}
    </div>
  );
}
