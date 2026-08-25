'use client';

import { useContext, useState, useEffect } from 'react';
import { CompanyContext } from '../layout';
import CanonicalTag from '@/components/CanonicalTag';
import SearchFilterBar from '@/components/SearchFilterBar';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getCanonicalId } from '@/lib/idMapper';
import Pagination from '@/components/Pagination';
import { createPortal } from 'react-dom';

export default function WorkspaceChallenges() {
  const {
    company,
    competitions,
    token,
    handleAddCompetition,
    handleDeleteCompetition
  } = useContext(CompanyContext);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ exp: [] });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilters]);

  const categories = [
    {
      key: 'exp',
      label: 'Experience Required',
      options: [
        { value: 'Entry-Level (0-2 years)', label: 'Entry-Level (0-2 years)' },
        { value: 'Mid-Level (2-5 years)', label: 'Mid-Level (2-5 years)' },
        { value: 'Senior (5+ years)', label: 'Senior (5+ years)' }
      ]
    }
  ];

  // Add Competition Modal State
  const [isAddingComp, setIsAddingComp] = useState(false);
  const [compTitle, setCompTitle] = useState('');
  const [compDesc, setCompDesc] = useState('');
  const [compSkills, setCompSkills] = useState('');
  const [compExp, setCompExp] = useState('Entry-Level (0-2 years)');
  const [compLang, setCompLang] = useState('Python');
  const [compOther, setCompOther] = useState('');
  const [compTemplateRepo, setCompTemplateRepo] = useState('');
  const [orgRepos, setOrgRepos] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [compError, setCompError] = useState('');
  const [compSuccess, setCompSuccess] = useState('');

  useEffect(() => {
    if (isAddingComp) {
      fetchOrgRepos();
    }
  }, [isAddingComp]);

  const fetchOrgRepos = async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch('/api/company/github-repos', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setOrgRepos(data.repos || []);
      }
    } catch (err) {
      console.error('Failed to load GitHub repos:', err);
    } finally {
      setLoadingRepos(false);
    }
  };

  // Candidates Roster Modal State
  const [selectedComp, setSelectedComp] = useState(null);
  const [enrolledCandidates, setEnrolledCandidates] = useState([]);
  const [isEnrolledOpen, setIsEnrolledOpen] = useState(false);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Confirmation state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [compToDelete, setCompToDelete] = useState(null);

  // Handle viewing enrolled candidates
  const handleViewEnrolled = async (competition, e) => {
    e.stopPropagation();
    setRosterLoading(true);
    try {
      const res = await fetch(`/api/company/competitions/${competition.id}/enrolled`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedComp(competition);
        setEnrolledCandidates(data.enrolledUsers || []);
        setIsEnrolledOpen(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRosterLoading(false);
    }
  };

  // Submit Hiring Challenge
  const onSubmitCompetition = async (e) => {
    e.preventDefault();
    setCompError('');
    setCompSuccess('');

    if (!compTitle.trim() || !compDesc.trim() || !compTemplateRepo.trim()) {
      setCompError('Title, description, and GitHub template repository are required');
      return;
    }

    const res = await handleAddCompetition(compTitle, compDesc, compLang, compSkills, compExp, compOther, compTemplateRepo);
    if (res.success) {
      setCompSuccess('Hiring challenge published successfully!');
      setCompTitle('');
      setCompDesc('');
      setCompLang('Python');
      setCompSkills('');
      setCompExp('Entry-Level (0-2 years)');
      setCompOther('');
      setCompTemplateRepo('');
      setIsAddingComp(false);
    } else {
      setCompError(res.error || 'Failed to create challenge');
    }
  };

  const triggerDeleteConfirm = (comp, e) => {
    e.stopPropagation();
    setCompToDelete(comp);
    setConfirmOpen(true);
  };

  // Filter challenges client-side
  const filteredComps = competitions.filter((c) => {
    const canonicalId = getCanonicalId('challenge', c.id);
    const matchesSearch =
      searchQuery === '' ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      canonicalId.toLowerCase().includes(searchQuery.toLowerCase());

    const selectedExp = selectedFilters.exp || [];
    const matchesExp = selectedExp.length === 0 || selectedExp.includes(c.experienceRequired);

    return matchesSearch && matchesExp;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentComps = filteredComps.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Hiring Challenges</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">Publish competence verifications and monitor candidate enrollments.</p>
        </div>
        <button
          disabled={!company.isVerified}
          onClick={() => setIsAddingComp(true)}
          className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <span>➕</span> Publish Challenge
        </button>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search challenges by title or ID (e.g. CHL-0001)..."
        categories={categories}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
        onClear={() => {
          setSearchQuery('');
          setSelectedFilters({ exp: [] });
        }}
      />

      {/* Table Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                <th className="p-4 pl-6">Challenge ID</th>
                <th className="p-4">Title</th>
                <th className="p-4">Experience Tier</th>
                <th className="p-4">Key Abstractions</th>
                <th className="p-4">Created Representative</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentComps.map((c) => (
                <tr key={c.id} className="interactive-row hover:bg-slate-50/50">
                  <td className="p-4 pl-6 font-medium">
                    <CanonicalTag type="challenge" id={c.id} />
                  </td>
                  <td className="p-4 font-black text-slate-900 text-sm">{c.title}</td>
                  <td className="p-4 text-slate-500 font-bold">{c.experienceRequired}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                      {c.skillsRequired.map((s, idx) => (
                        <span key={idx} className="bg-slate-100 border border-slate-200/60 text-[9px] font-extrabold px-2 py-0.5 rounded text-slate-600">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-slate-500 font-semibold">
                    {c.createdBy.firstname} {c.createdBy.lastname}
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <button
                        onClick={(e) => handleViewEnrolled(c, e)}
                        disabled={rosterLoading}
                        className="px-3.5 py-1.5 bg-brand-light border border-brand/10 hover:bg-brand/15 text-brand text-[10px] font-black rounded-lg transition cursor-pointer"
                      >
                        Candidates Roster
                      </button>
                      <button
                        onClick={(e) => triggerDeleteConfirm(c, e)}
                        className="px-3 py-1.5 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 text-[10px] font-black rounded-lg transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredComps.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 font-semibold text-sm">
                    No active hiring challenges published in this workspace.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={filteredComps.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* Roster Modal */}
      {mounted && isEnrolledOpen && selectedComp && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[10px] flex items-center justify-center overflow-y-auto py-8 px-4 z-50 animate-fade-in" onClick={() => setIsEnrolledOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 w-full max-w-3xl relative animate-modal max-h-[90vh] overflow-y-auto my-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsEnrolledOpen(false)} className="absolute top-4 right-4 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2.5 mb-5 uppercase tracking-wider">
              Enrolled Roster: "{selectedComp.title}"
            </h3>

            {enrolledCandidates.length === 0 ? (
              <p className="text-xs text-slate-400 font-semibold text-center py-10">No candidates have registered for this challenge yet.</p>
            ) : (
              <div className="max-h-[300px] overflow-y-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-extrabold uppercase tracking-wider">
                      <th className="p-3 pl-4">Candidate ID</th>
                      <th className="p-3">Enrollment ID</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3 pr-4">Enrolled At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {enrolledCandidates.map(cand => {
                      return (
                        <tr key={cand.id} className="hover:bg-slate-50">
                          <td className="p-3 pl-4">
                            <CanonicalTag type="candidate" id={cand.id} />
                          </td>
                          <td className="p-3">
                            <CanonicalTag type="enrollment" id={`${selectedComp.id}-${cand.id}`} />
                          </td>
                          <td className="p-3 font-extrabold text-slate-900">{cand.firstname} {cand.lastname}</td>
                          <td className="p-3 text-slate-500 font-semibold">{cand.email}</td>
                          <td className="p-3 text-slate-500">{cand.phone || 'N/A'}</td>
                          <td className="p-3 pr-4 text-slate-400">{new Date(cand.createdAt).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setIsEnrolledOpen(false)}
                className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 transition cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Challenge Modal */}
      {mounted && isAddingComp && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[10px] flex items-center justify-center overflow-y-auto py-8 px-4 z-50 animate-fade-in" onClick={() => setIsAddingComp(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 w-full max-w-lg relative animate-modal max-h-[90vh] overflow-y-auto my-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsAddingComp(false)} className="absolute top-4 right-5 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2.5 mb-6 uppercase tracking-wider">
              Publish Hiring Challenge
            </h3>

            <form onSubmit={onSubmitCompetition} className="flex flex-col gap-4.5 text-xs text-slate-700">
              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">Challenge Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Fullstack Engineer Challenge"
                  value={compTitle}
                  onChange={(e) => setCompTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-medium"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">Challenge Description *</label>
                <textarea
                  placeholder="Outline the coding instructions, sandbox criteria, and key unit testing requirements."
                  value={compDesc}
                  onChange={(e) => setCompDesc(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-medium resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">Required Skills (Comma Separated) *</label>
                <input
                  type="text"
                  placeholder="React, Node.js, Express, PostgreSQL"
                  value={compSkills}
                  onChange={(e) => setCompSkills(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">Experience Tier *</label>
                  <select
                     value={compExp}
                     onChange={(e) => setCompExp(e.target.value)}
                     className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-bold cursor-pointer"
                  >
                    <option value="Entry-Level (0-2 years)">Entry-Level (0-2 years)</option>
                    <option value="Mid-Level (2-5 years)">Mid-Level (2-5 years)</option>
                    <option value="Senior (5+ years)">Senior (5+ years)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">Target Language *</label>
                  <select
                     value={compLang}
                     onChange={(e) => setCompLang(e.target.value)}
                     className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-bold cursor-pointer"
                  >
                    <option value="Python">Python</option>
                    <option value="JavaScript/TypeScript">JavaScript/TypeScript</option>
                    <option value="C++">C++</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">Other Criteria / Constraints</label>
                <textarea
                  placeholder="Sandbox timeout details, limits, submission rules..."
                  value={compOther}
                  onChange={(e) => setCompOther(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-medium resize-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">GitHub Template Repository *</label>
                {loadingRepos ? (
                  <div className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl bg-slate-50/50 text-slate-400 font-semibold flex items-center gap-2">
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-400/25 border-b-slate-600"></div>
                    <span>Loading organization repositories...</span>
                  </div>
                ) : orgRepos.length > 0 ? (
                  <select
                    value={compTemplateRepo}
                    onChange={(e) => setCompTemplateRepo(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-bold cursor-pointer"
                    required
                  >
                    <option value="">Select a template repository...</option>
                    {orgRepos.map(r => (
                      <option key={r.fullName} value={r.htmlUrl}>{r.fullName}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full px-3.5 py-2.5 border border-amber-200 bg-amber-50/30 text-amber-800 rounded-xl text-[11px] font-medium leading-relaxed">
                    ⚠️ No templates found in your organization. Please ensure the GitHub App is installed and templates are created in your org.
                  </div>
                )}
              </div>

              {compError && <p className="text-xs font-bold text-rose-500">{compError}</p>}
              {compSuccess && <p className="text-xs font-bold text-emerald-500">{compSuccess}</p>}

              <div className="flex justify-end gap-3 mt-3.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingComp(false)}
                  className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white font-extrabold rounded-xl shadow-md transition cursor-pointer shadow-brand/10"
                >
                  Publish Challenge
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirmation dialog */}
      {compToDelete && (
        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => {
            setConfirmOpen(false);
            setCompToDelete(null);
          }}
          onConfirm={() => handleDeleteCompetition(compToDelete.id)}
          actionName="Delete Challenge"
          targetName={compToDelete.title}
          targetId={getCanonicalId('challenge', compToDelete.id)}
          consequenceText="This will permanently delete the challenge. Any enrolled candidates will no longer be able to access the task instructions or submit their code."
          isDestructive={true}
          requireTypeMatch={true}
        />
      )}
    </div>
  );
}
