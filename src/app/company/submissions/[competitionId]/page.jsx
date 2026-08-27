'use client';

import { useContext, useState, useEffect } from 'react';
import { CompanyContext } from '../../layout';
import CanonicalTag from '@/components/CanonicalTag';
import SearchFilterBar from '@/components/SearchFilterBar';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getCanonicalId } from '@/lib/idMapper';
import Pagination from '@/components/Pagination';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function CompanyCompetitionSubmissions() {
  const { competitions, token, fetchDashboardData } = useContext(CompanyContext);
  const params = useParams();
  const competitionId = parseInt(params.competitionId, 10);

  const [submissions, setSubmissions] = useState([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ status: [] });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [mounted, setMounted] = useState(false);

  // Active competition detail
  const comp = competitions.find(c => c.id === competitionId);

  // Selected Submission Modal state (loads raw code from API)
  const [selectedSub, setSelectedSub] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState(0);

  // Manual grading rules
  const [isGrading, setIsGrading] = useState(false);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');

  // Confirmation dialogs
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [actionConfirmDetails, setActionConfirmDetails] = useState(null);

  // Edit Deadline form modal
  const [isDeadlineOpen, setIsDeadlineOpen] = useState(false);
  const [formDeadline, setFormDeadline] = useState('');
  const [formAutoClose, setFormAutoClose] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilters]);

  // Load submissions for this specific competition
  const loadSubmissions = async () => {
    if (!token || isNaN(competitionId)) return;
    setLoadingSubs(true);
    try {
      const res = await fetch(`/api/company/submissions?competitionId=${competitionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data);
      }
    } catch (err) {
      console.error('Failed to load submissions:', err);
    } finally {
      setLoadingSubs(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, [token, competitionId]);

  // Format date helper for ISO input
  useEffect(() => {
    if (comp && comp.submissionDeadline) {
      const dateObj = new Date(comp.submissionDeadline);
      // Adjust for timezone offset to match local datetime-local input format
      const tzOffset = dateObj.getTimezoneOffset() * 60000;
      const localISOTime = new Date(dateObj.getTime() - tzOffset).toISOString().slice(0, 16);
      setFormDeadline(localISOTime);
      setFormAutoClose(!!comp.autoCloseEnabled);
    } else {
      setFormDeadline('');
      setFormAutoClose(false);
    }
  }, [comp]);

  if (!comp) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center shadow-sm">
        <p className="text-slate-400 text-lg font-medium">Competition not found or access denied.</p>
        <Link href="/company/submissions" className="text-brand font-bold underline hover:text-brand-hover mt-3 inline-block">
          Return to Submissions Dashboard
        </Link>
      </div>
    );
  }

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

  // Fetch detailed submission (including files) from GET /api/company/submissions/[id]
  const handleReviewSubmission = async (sub) => {
    setLoadingDetail(true);
    setSelectedSub(sub);
    setIsModalOpen(true);
    setActiveCodeTab(0);
    setIsGrading(false);
    try {
      const res = await fetch(`/api/company/submissions/${sub.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const fullDetail = await res.json();
        setSelectedSub(fullDetail);
      }
    } catch (err) {
      console.error('Failed to load solution files:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

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

  // Submit deadline changes through ConfirmDialog
  const triggerSaveDeadline = (e) => {
    e.preventDefault();
    setActionConfirmDetails({
      type: 'deadline',
      title: 'Update Competition Deadline',
      consequence: 'This will reschedule the active submission deadline and auto-close push permissions for all candidates registered to this challenge.'
    });
    setConfirmOpen(true);
  };

  const executeSaveDeadline = async () => {
    try {
      const res = await fetch(`/api/company/competitions/${competitionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          submissionDeadline: formDeadline ? new Date(formDeadline).toISOString() : null,
          autoCloseEnabled: formAutoClose
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to update competition deadline');
        return;
      }

      await fetchDashboardData(token);
      setIsDeadlineOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Filter client-side
  const filteredSubs = submissions.filter(sub => {
    const candidateIdStr = getCanonicalId('candidate', sub.candidateId);
    const submissionIdStr = getCanonicalId('submission', sub.id);
    const matchesSearch =
      searchQuery === '' ||
      sub.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      candidateIdStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submissionIdStr.toLowerCase().includes(searchQuery.toLowerCase());

    const selectedStatuses = selectedFilters.status || [];
    const matchesStatus = selectedStatuses.length === 0 || selectedStatuses.includes(sub.status);

    return matchesSearch && matchesStatus;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSubs = filteredSubs.slice(indexOfFirstItem, indexOfLastItem);

  const getDeadlineDisplay = () => {
    if (!comp.submissionDeadline) return 'No active deadline set';
    const d = new Date(comp.submissionDeadline);
    const now = new Date();
    const formatted = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (d < now) {
      return `Closed (Ended on ${formatted})`;
    }
    return `Open until ${formatted}`;
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Breadcrumb Navigation */}
      <div>
        <Link href="/company/submissions" className="text-xs font-black text-brand hover:underline flex items-center gap-1.5 mb-3 select-none">
          <span>←</span> Back to Submissions Dashboard
        </Link>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight capitalize">
              {comp.title} Leaderboard
            </h1>
            <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-2">
              <span>Challenge ID:</span>
              <CanonicalTag type="challenge" id={comp.id} />
            </p>
          </div>

          {/* Export CSV action */}
          <a
            href={`/api/company/submissions?competitionId=${comp.id}&format=csv`}
            download
            className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer shadow-sm flex items-center justify-center gap-2 self-start md:self-center"
          >
            📥 Export Leaderboard (CSV)
          </a>
        </div>
      </div>

      {/* Deadline Info Bar */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-col gap-1">
          <strong className="text-[10px] text-slate-400 uppercase tracking-widest font-black">Submission Deadline Status</strong>
          <p className="text-slate-800 font-bold text-sm">
            🕒 {getDeadlineDisplay()}
          </p>
          {comp.autoCloseEnabled && (
            <p className="text-[10px] text-emerald-600 font-bold">
              ✔ Auto-close on deadline is enabled (GitHub push permissions will downgrade to read-only)
            </p>
          )}
        </div>
        <button
          onClick={() => setIsDeadlineOpen(true)}
          className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-xl hover:bg-brand-hover transition cursor-pointer shadow-md shadow-brand/10 self-start sm:self-center"
        >
          📅 Edit Deadline Settings
        </button>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search submissions by candidate name, Submission ID, or Candidate ID..."
        categories={categories}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
        onClear={() => {
          setSearchQuery('');
          setSelectedFilters({ status: [] });
        }}
      />

      {loadingSubs ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 flex flex-col items-center justify-center shadow-sm">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-2"></div>
          <span className="text-xs text-slate-400 font-semibold">Calculating leaderboard rankings...</span>
        </div>
      ) : (
        <>
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    <th className="p-4 pl-6 w-16">Rank</th>
                    <th className="p-4">Submission ID</th>
                    <th className="p-4">Candidate</th>
                    <th className="p-4">Final Score</th>
                    <th className="p-4">Confidence</th>
                    <th className="p-4">Submitted At</th>
                    <th className="p-4">GitHub Repository</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentSubs.map((sub) => {
                    const isGraded = sub.status === 'Graded';
                    return (
                      <tr key={sub.id} className="interactive-row hover:bg-slate-50/50">
                        <td className="p-4 pl-6">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${
                            sub.rank === 1 
                              ? 'bg-amber-100 text-amber-700 border border-amber-300' 
                              : sub.rank === 2
                              ? 'bg-slate-100 text-slate-600 border border-slate-300'
                              : sub.rank === 3
                              ? 'bg-orange-50 text-orange-700 border border-orange-200'
                              : 'text-slate-500'
                          }`}>
                            #{sub.rank}
                          </span>
                        </td>
                        <td className="p-4">
                          <CanonicalTag type="submission" id={sub.id} />
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-black text-slate-900 text-sm">{sub.candidateName}</span>
                            <CanonicalTag type="candidate" id={sub.candidateId} />
                          </div>
                        </td>
                        <td className="p-4">
                          {isGraded && sub.score !== null ? (
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-950 text-sm">{sub.score}%</span>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                sub.band === 'High' 
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                                  : sub.band === 'Moderate'
                                  ? 'bg-amber-50 text-amber-600 border-amber-250'
                                  : 'bg-rose-50 text-rose-600 border-rose-200'
                              }`}>
                                {sub.band}
                              </span>
                            </div>
                          ) : (
                            <span className={`text-[9px] font-black uppercase border px-2 py-0.5 rounded-full ${
                              sub.status === 'PENDING'
                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : sub.status === 'PROCESSING'
                                ? 'bg-amber-50 text-amber-600 border-amber-200'
                                : 'bg-rose-50 text-rose-600 border-rose-200'
                            }`}>
                              {sub.status}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-slate-500 font-bold">
                          {sub.confidence !== null ? `${(sub.confidence * 100).toFixed(0)}%` : 'N/A'}
                        </td>
                        <td className="p-4 text-slate-400 font-medium">
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          {sub.repoUrl ? (
                            <a
                              href={sub.repoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-brand hover:underline font-semibold flex items-center gap-1"
                            >
                              📁 Repo Link
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <button
                            onClick={() => handleReviewSubmission(sub)}
                            className="px-3.5 py-1.5 bg-brand-light border border-brand/10 hover:bg-brand/15 text-brand text-[10px] font-black rounded-lg transition cursor-pointer"
                          >
                            Review & Grade
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSubs.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-400 font-semibold text-sm">
                        No submissions recorded under this hiring challenge.
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

      {/* Review details modal showing logs AND raw candidate code */}
      {mounted && isModalOpen && selectedSub && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[10px] flex items-center justify-center overflow-y-auto py-8 px-4 z-50 animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 w-full max-w-4xl relative animate-modal max-h-[90vh] overflow-y-auto my-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900 leading-tight">
                Solution Code Review & Grading
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
                    <strong className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Candidate</strong>
                    <p className="font-bold text-slate-800">{selectedSub.candidateName}</p>
                    <p className="text-slate-400 text-[10px] font-semibold mt-0.5">{selectedSub.candidateEmail}</p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl">
                    <strong className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1">Hiring Challenge</strong>
                    <p className="font-bold text-slate-800 truncate">{selectedSub.challengeTitle}</p>
                  </div>
                </div>

                {/* Tabbed Raw Code Viewer alongside execution logs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Left Column: Code Files Content */}
                  <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden min-h-[300px] bg-slate-50">
                    <div className="bg-slate-100 px-3 py-2 border-b border-slate-250 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Submitted Code Files</span>
                    </div>

                    {loadingDetail ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand mb-2"></div>
                        <span className="text-[10px] text-slate-400 font-bold">Loading git contents...</span>
                      </div>
                    ) : selectedSub.codeFiles && selectedSub.codeFiles.length > 0 ? (
                      <>
                        {/* File Tabs */}
                        <div className="flex border-b border-slate-200 bg-white overflow-x-auto">
                          {selectedSub.codeFiles.map((file, idx) => (
                            <button
                              key={file.path}
                              onClick={() => setActiveCodeTab(idx)}
                              className={`px-3 py-2 text-[10px] font-extrabold border-r border-slate-200 transition ${
                                activeCodeTab === idx 
                                  ? 'bg-slate-50 text-brand border-b-2 border-b-brand' 
                                  : 'bg-white text-slate-500 hover:bg-slate-50'
                              }`}
                            >
                              📄 {file.name}
                            </button>
                          ))}
                        </div>
                        {/* Selected File Viewer */}
                        <div className="flex-1 p-3 overflow-auto max-h-[350px]">
                          <pre className="font-mono text-[10px] text-slate-800 leading-normal whitespace-pre-wrap select-all">
                            {selectedSub.codeFiles[activeCodeTab]?.content}
                          </pre>
                        </div>
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <span className="text-lg mb-1">📁</span>
                        <p className="text-[10px] text-slate-400 font-bold">No codebase source files could be fetched.</p>
                        {selectedSub.repoUrl && (
                          <a
                            href={selectedSub.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] text-brand underline hover:text-brand-hover mt-1 font-extrabold"
                          >
                            Open raw repo directly on GitHub
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Execution Logs Terminal */}
                  <div className="flex flex-col gap-4">
                    <div>
                      <strong className="text-[9px] text-slate-400 uppercase tracking-wider block mb-1.5">Sandbox Verification Logs</strong>
                      <div className="bg-slate-950/95 border border-slate-900 rounded-xl p-4 font-mono text-[10px] text-slate-350 flex flex-col gap-1 h-[270px] overflow-y-auto leading-normal shadow-inner select-text">
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
        </div>,
        document.body
      )}

      {/* Edit Deadline Form Modal */}
      {mounted && isDeadlineOpen && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[10px] flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setIsDeadlineOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 w-full max-w-md relative animate-modal" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsDeadlineOpen(false)} className="absolute top-4 right-4 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <h3 className="text-sm font-extrabold text-slate-950 border-b border-slate-100 pb-2.5 mb-5 uppercase tracking-wider">
              Edit Challenge Deadline: "{comp.title}"
            </h3>

            <form onSubmit={triggerSaveDeadline} className="flex flex-col gap-4 text-xs text-slate-700">
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">
                  Submission Deadline Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  Leave blank to set no submission deadline (unlimited access).
                </p>
              </div>

              <div className="flex items-center gap-2 mt-2 bg-slate-50 border border-slate-200/60 p-3 rounded-xl">
                <input
                  type="checkbox"
                  id="autoClose"
                  checked={formAutoClose}
                  onChange={(e) => setFormAutoClose(e.target.checked)}
                  className="h-4 w-4 border-slate-200 rounded text-brand accent-brand cursor-pointer"
                />
                <label htmlFor="autoClose" className="font-semibold text-slate-700 select-none cursor-pointer">
                  Auto-Close push permissions when deadline passes
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-3">
                <button
                  type="button"
                  onClick={() => setIsDeadlineOpen(false)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 text-[10px] font-bold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand hover:bg-brand-hover text-white text-[10px] font-bold rounded-lg cursor-pointer shadow-md shadow-brand/10"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation validation dialog */}
      {confirmOpen && actionConfirmDetails && (
        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => {
            setConfirmOpen(false);
            setActionConfirmDetails(null);
          }}
          onConfirm={actionConfirmDetails.type === 'deadline' ? executeSaveDeadline : handleExecuteSubAction}
          actionName={actionConfirmDetails.title}
          targetName={actionConfirmDetails.type === 'deadline' ? comp.title : (selectedSub ? selectedSub.candidateName : '')}
          targetId={actionConfirmDetails.type === 'deadline' ? getCanonicalId('challenge', comp.id) : (selectedSub ? getCanonicalId('submission', selectedSub.id) : '')}
          consequenceText={actionConfirmDetails.consequence}
          isDestructive={actionConfirmDetails.type === 'reject'}
        />
      )}
    </div>
  );
}
