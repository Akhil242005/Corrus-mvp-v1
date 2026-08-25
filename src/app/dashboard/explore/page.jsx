'use client';

import { useContext, useState, useEffect } from 'react';
import { CandidateContext } from '../layout';
import CanonicalTag from '@/components/CanonicalTag';
import SearchFilterBar from '@/components/SearchFilterBar';
import { getCanonicalId } from '@/lib/idMapper';
import Pagination from '@/components/Pagination';

export default function ExploreCompetitions() {
  const {
    user,
    competitions,
    token,
    handleEnroll,
    activeModal,
    setActiveModal
  } = useContext(CandidateContext);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ company: [], skill: [] });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6; // Grid displays 6 cards per page nicely

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilters]);

  // Selected Competition Modal state
  const [selectedComp, setSelectedComp] = useState(null);

  // Showcase company state
  const [showcaseCompany, setShowcaseCompany] = useState(null);
  const [showcaseCompetitions, setShowcaseCompetitions] = useState([]);
  const [showcaseOpen, setShowcaseOpen] = useState(false);

  // Extract unique companies and skills for select filters
  const uniqueCompanies = [];
  const uniqueSkills = [];
  competitions.forEach(c => {
    if (c.companyId && !uniqueCompanies.some(comp => comp.id === c.companyId.id)) {
      uniqueCompanies.push(c.companyId);
    }
    (c.skillsRequired || []).forEach(skill => {
      const s = skill.trim().toLowerCase();
      if (s && !uniqueSkills.includes(s)) {
        uniqueSkills.push(s);
      }
    });
  });

  const categories = [
    {
      key: 'company',
      label: 'Filter by Company',
      options: uniqueCompanies.map((c) => ({
        value: c.id.toString(),
        label: c.name
      }))
    },
    {
      key: 'skill',
      label: 'Filter by Skill',
      options: uniqueSkills.map((s) => ({
        value: s,
        label: s.toUpperCase()
      }))
    }
  ];

  // Handle company showcase lookup
  const handleOpenCompanyShowcase = async (companyId, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/companies/${companyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setShowcaseCompany(data.company);
        setShowcaseCompetitions(data.competitions);
        setShowcaseOpen(true);
      }
    } catch (err) {
      console.error('Failed to open company showcase:', err);
    }
  };

  // Filter listings
  const filteredComps = competitions.filter((c) => {
    const canonicalId = getCanonicalId('challenge', c.id);
    const matchesSearch =
      searchQuery === '' ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.taskDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.companyId.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      canonicalId.toLowerCase().includes(searchQuery.toLowerCase());

    const selectedCompanies = selectedFilters.company || [];
    const matchesCompany =
      selectedCompanies.length === 0 ||
      selectedCompanies.includes(c.companyId?.id?.toString());

    const selectedSkills = selectedFilters.skill || [];
    const matchesSkill =
      selectedSkills.length === 0 ||
      c.skillsRequired.some((skill) => selectedSkills.includes(skill.trim().toLowerCase()));

    return matchesSearch && matchesCompany && matchesSkill;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentComps = filteredComps.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 capitalize">Explore Competitions</h1>
        <p className="text-sm text-slate-500">Discover competence challenges & verify your engineering skills.</p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search challenges by title, skills, company, or Challenge ID (e.g. CHL-XXXXX)..."
        categories={categories}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
        onClear={() => {
          setSearchQuery('');
          setSelectedFilters({ company: [], skill: [] });
        }}
      />

      {/* Competitions Grid */}
      {filteredComps.length === 0 ? (
        <div className="w-full bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <p className="text-slate-400 text-lg font-medium">No active competitions found.</p>
          <p className="text-sm text-slate-400 mt-1">Try adjusting your search queries or filter categories.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentComps.map((c) => {
              const hasEnrolled = c.enrolledUsers?.includes(user?.id) || false;
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
                      {hasEnrolled && (
                        <span className="text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                          Enrolled
                        </span>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-400 mb-3">
                      By{' '}
                      <a
                        href="#"
                        onClick={(e) => handleOpenCompanyShowcase(c.companyId.id, e)}
                        className="font-semibold text-slate-700 underline hover:text-brand"
                      >
                        {c.companyId?.name}
                      </a>
                    </p>

                    <p className="text-sm text-slate-600 line-clamp-3 mb-4">
                      {c.taskDescription}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Challenge ID:</span>
                      <CanonicalTag type="challenge" id={c.id} />
                    </div>
                    <p className="text-xs text-slate-500">
                      <strong>Required Skills:</strong> {c.skillsRequired.join(', ') || 'N/A'}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-semibold text-slate-600">🕒 {c.experienceRequired} exp</span>
                      {!hasEnrolled && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEnroll(c.id);
                          }}
                          className="px-4 py-1.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer transition duration-150"
                        >
                          Enroll Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredComps.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Dynamic Competition Details Modal overlay */}
      {selectedComp && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setSelectedComp(null)}>
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl p-8 w-full max-w-2xl relative animate-modal" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setSelectedComp(null)} className="absolute top-4 right-5 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <h2 className="text-2xl font-bold text-brand mb-2">{selectedComp.title}</h2>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-slate-400">
                Published by{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    setSelectedComp(null);
                    handleOpenCompanyShowcase(selectedComp.companyId.id, e);
                  }}
                  className="font-semibold text-slate-700 underline hover:text-brand"
                >
                  {selectedComp.companyId?.name}
                </a>
              </span>
              <CanonicalTag type="challenge" id={selectedComp.id} />
            </div>

            <div className="flex flex-col gap-4 text-sm text-slate-700 mb-6">
              <div>
                <strong className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Challenge Brief</strong>
                <p className="leading-relaxed bg-slate-50 border border-slate-200 p-4 rounded-lg whitespace-pre-wrap">
                  {selectedComp.taskDescription}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Skills Required</strong>
                  <p className="font-semibold text-slate-800 font-mono text-xs">
                    {selectedComp.skillsRequired.join(', ') || 'N/A'}
                  </p>
                </div>
                <div>
                  <strong className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Experience Requirement</strong>
                  <p className="font-semibold text-slate-800">
                    {selectedComp.experienceRequired}
                  </p>
                </div>
              </div>

              {selectedComp.otherRequirements && (
                <div>
                  <strong className="text-xs font-bold text-slate-400 uppercase tracking-wide block mb-1">Other Criteria</strong>
                  <p className="text-slate-600 whitespace-pre-wrap">{selectedComp.otherRequirements}</p>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end gap-3">
              <button
                onClick={() => setSelectedComp(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-lg border border-slate-200 transition duration-150 cursor-pointer"
              >
                Cancel
              </button>
              {!(selectedComp.enrolledUsers?.includes(user?.id) || false) && (
                <button
                  onClick={() => {
                    setSelectedComp(null);
                    handleEnroll(selectedComp.id);
                  }}
                  className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-lg shadow-md transition duration-150 cursor-pointer"
                >
                  Enroll in Competition
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Showcase Modal */}
      {showcaseOpen && showcaseCompany && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setShowcaseOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-xl shadow-2xl p-6 w-full max-w-xl relative animate-modal" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowcaseOpen(false)} className="absolute top-3 right-4 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <h2 className="text-xl font-bold text-brand mb-2">{showcaseCompany.name}</h2>
            <p className="mb-2"><strong>Location:</strong> {showcaseCompany.place}</p>
            {showcaseCompany.website && (
              <p className="mb-2">
                <strong>Website:</strong>{' '}
                <a href={showcaseCompany.website} target="_blank" rel="noreferrer" className="text-brand font-semibold underline hover:text-brand-hover">
                  {showcaseCompany.website}
                </a>
              </p>
            )}
            {showcaseCompany.description && (
              <p className="text-slate-600 italic border-l-2 border-slate-200 pl-3 my-3">
                "{showcaseCompany.description}"
              </p>
            )}

            <h3 className="text-sm font-bold text-slate-900 border-t border-slate-100 pt-3 mt-4 mb-2">Active Challenges</h3>
            {showcaseCompetitions.length === 0 ? (
              <p className="text-xs text-slate-400">No active competitions published.</p>
            ) : (
              <div className="max-h-[160px] overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-2.5 font-bold text-slate-700">Challenge Title</th>
                      <th className="p-2.5 font-bold text-slate-700">Experience</th>
                    </tr>
                  </thead>
                  <tbody>
                    {showcaseCompetitions.map(sc => (
                      <tr key={sc.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-2.5 text-slate-800 font-semibold">{sc.title}</td>
                        <td className="p-2.5 text-slate-600">{sc.experienceRequired}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
