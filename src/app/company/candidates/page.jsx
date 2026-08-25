'use client';

import { useContext, useState, useEffect } from 'react';
import { CompanyContext } from '../layout';
import CanonicalTag from '@/components/CanonicalTag';
import SearchFilterBar from '@/components/SearchFilterBar';
import { getCanonicalId } from '@/lib/idMapper';
import Pagination from '@/components/Pagination';

export default function CompanyCandidates() {
  const { competitions, token } = useContext(CompanyContext);

  const [candidatesList, setCandidatesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ comp: [] });

  const categories = [
    {
      key: 'comp',
      label: 'Filter by Challenge',
      options: competitions.map((c) => ({
        value: c.id.toString(),
        label: c.title
      }))
    }
  ];

  // Details Modal state
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  useEffect(() => {
    const loadAllCandidates = async () => {
      setLoading(true);
      const uniqueCandsMap = {};
      try {
        for (const comp of competitions) {
          const res = await fetch(`/api/company/competitions/${comp.id}/enrolled`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            (data.enrolledUsers || []).forEach(cand => {
              if (!uniqueCandsMap[cand.id]) {
                uniqueCandsMap[cand.id] = {
                  ...cand,
                  enrolledCompetitions: [{
                    id: comp.id,
                    title: comp.title,
                    enrolledAt: cand.createdAt
                  }]
                };
              } else {
                if (!uniqueCandsMap[cand.id].enrolledCompetitions.some(c => c.id === comp.id)) {
                  uniqueCandsMap[cand.id].enrolledCompetitions.push({
                    id: comp.id,
                    title: comp.title,
                    enrolledAt: cand.createdAt
                  });
                }
              }
            });
          }
        }
        setCandidatesList(Object.values(uniqueCandsMap));
      } catch (err) {
        console.error('Failed to load company candidates:', err);
      } finally {
        setLoading(false);
      }
    };

    if (competitions.length > 0) {
      loadAllCandidates();
    }
  }, [competitions, token]);

  // Filter candidates list client-side
  const filteredCandidates = candidatesList.filter((cand) => {
    const canonicalId = getCanonicalId('candidate', cand.id);
    const fullname = `${cand.firstname} ${cand.lastname}`.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      fullname.includes(searchQuery.toLowerCase()) ||
      cand.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      canonicalId.toLowerCase().includes(searchQuery.toLowerCase());

    const selectedComps = selectedFilters.comp || [];
    const matchesComp =
      selectedComps.length === 0 ||
      cand.enrolledCompetitions.some((c) => selectedComps.includes(c.id.toString()));

    return matchesSearch && matchesComp;
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilters]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCandidates = filteredCandidates.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Candidate Directory</h1>
        <p className="text-xs font-semibold text-slate-400 mt-1">Audit active candidate profiles and challenge participation logs.</p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search candidates by name, email, or ID (e.g. CND-0001)..."
        categories={categories}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
        onClear={() => {
          setSearchQuery('');
          setSelectedFilters({ comp: [] });
        }}
      />

      {loading ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 flex flex-col items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand mb-2"></div>
          <span className="text-xs text-slate-400 font-semibold">Loading candidate files...</span>
        </div>
      ) : (
        <>
          {/* Table Container */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    <th className="p-4 pl-6">Candidate ID</th>
                    <th className="p-4">Full Name</th>
                    <th className="p-4">Email</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Published Enrollments</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentCandidates.map((cand) => (
                    <tr key={cand.id} className="interactive-row hover:bg-slate-50/50">
                      <td className="p-4 pl-6">
                        <CanonicalTag type="candidate" id={cand.id} />
                      </td>
                      <td className="p-4 font-black text-slate-900 text-sm">{cand.firstname} {cand.lastname}</td>
                      <td className="p-4 text-slate-500 font-semibold">{cand.email}</td>
                      <td className="p-4 text-slate-500 font-medium">{cand.phone || '—'}</td>
                      <td className="p-4 text-slate-500 font-semibold max-w-[240px] truncate">
                        {cand.enrolledCompetitions.map((c) => c.title).join(', ')}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <button
                          onClick={() => {
                            setSelectedCandidate(cand);
                            setIsDetailsOpen(true);
                          }}
                          className="px-3.5 py-1.5 bg-brand-light border border-brand/10 hover:bg-brand/15 text-brand text-[10px] font-black rounded-lg transition cursor-pointer"
                        >
                          View Profile Details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredCandidates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-slate-400 font-semibold text-sm">
                        No enrolled candidates found matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            currentPage={currentPage}
            totalItems={filteredCandidates.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {/* Candidate Detail Modal */}
      {isDetailsOpen && selectedCandidate && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" onClick={() => setIsDetailsOpen(false)}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 w-full max-w-xl relative animate-modal max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setIsDetailsOpen(false)} className="absolute top-4 right-5 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            {/* Header */}
            <div className="mb-6 border-b border-slate-100 pb-4">
              <h2 className="text-lg font-black text-slate-900 leading-tight">
                {selectedCandidate.firstname} {selectedCandidate.lastname}
              </h2>
              <p className="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1.5">
                <span>Candidate ID:</span>
                <span className="font-mono font-bold text-brand">{getCanonicalId('candidate', selectedCandidate.id)}</span>
              </p>
            </div>

            <div className="flex flex-col gap-5 text-xs text-slate-700 mb-6">
              <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-xl flex flex-col gap-1.5">
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1">Contact Information</span>
                <p><strong>Email:</strong> <span className="font-medium text-slate-800">{selectedCandidate.email}</span></p>
                <p><strong>Phone:</strong> <span className="font-medium text-slate-800">{selectedCandidate.phone || 'N/A'}</span></p>
              </div>

              <div>
                <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-2">Registered Challenge Enrollments</span>
                <ul className="flex flex-col gap-2.5 mt-1">
                  {selectedCandidate.enrolledCompetitions.map((c) => {
                    return (
                      <li key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center shadow-xs transition hover:border-brand/20">
                        <div>
                          <p className="font-black text-slate-900 text-xs">{c.title}</p>
                          <p className="text-slate-400 text-[10px] font-medium mt-0.5">Enrolled on: {new Date(c.enrolledAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[9px] font-mono font-bold text-slate-400">Enrollment ID</span>
                          <CanonicalTag type="enrollment" id={`${c.id}-${selectedCandidate.id}`} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex justify-end">
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
