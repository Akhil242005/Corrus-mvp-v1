'use client';

import { useContext, useState, useEffect } from 'react';
import { AdminContext } from '../../layout';
import CanonicalTag from '@/components/CanonicalTag';
import SearchFilterBar from '@/components/SearchFilterBar';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getCanonicalId } from '@/lib/idMapper';
import Pagination from '@/components/Pagination';

export default function ChallengesPage() {
  const { competitions, companies, handleDeleteCompetition } = useContext(AdminContext);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ company: [], experience: [] });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilters]);

  const categories = [
    {
      key: 'company',
      label: 'Filter by Company',
      options: companies.map((c) => ({
        value: c.id.toString(),
        label: c.name
      }))
    },
    {
      key: 'experience',
      label: 'Required Experience',
      options: [
        { value: 'Entry-Level (0-2 years)', label: 'Entry-Level (0-2 years)' },
        { value: 'Mid-Level (2-5 years)', label: 'Mid-Level (2-5 years)' },
        { value: 'Senior (5+ years)', label: 'Senior (5+ years)' }
      ]
    }
  ];

  // Confirmation States
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState(null);

  const triggerConfirm = (comp) => {
    setSelectedComp(comp);
    setConfirmOpen(true);
  };

  // Filter challenges client-side
  const filteredChallenges = competitions.filter((comp) => {
    const canonicalId = getCanonicalId('challenge', comp.id);
    const matchesSearch =
      searchQuery === '' ||
      comp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      comp.companyId?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      canonicalId.toLowerCase().includes(searchQuery.toLowerCase());

    const selectedCompanies = selectedFilters.company || [];
    const matchesCompany =
      selectedCompanies.length === 0 ||
      selectedCompanies.includes(comp.companyId?.id?.toString());

    const selectedExp = selectedFilters.experience || [];
    const matchesExperience =
      selectedExp.length === 0 ||
      selectedExp.includes(comp.experienceRequired);

    return matchesSearch && matchesCompany && matchesExperience;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentChallenges = filteredChallenges.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 capitalize">Platform Challenges</h1>
        <p className="text-sm text-slate-500">Audit published coding competitions, check creator profiles, and revoke outdated challenges.</p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by challenge title, company, or Challenge ID (e.g. CHL-XXXXX)..."
        categories={categories}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
        onClear={() => {
          setSearchQuery('');
          setSelectedFilters({ company: [], experience: [] });
        }}
      />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
              <th className="p-4 font-bold">Challenge ID</th>
              <th className="p-4 font-bold">Challenge Title</th>
              <th className="p-4 font-bold">Company Workspace</th>
              <th className="p-4 font-bold">Required Experience</th>
              <th className="p-4 font-bold">Created By</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentChallenges.map((comp) => (
              <tr key={comp.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4">
                  <CanonicalTag type="challenge" id={comp.id} />
                </td>
                <td className="p-4 font-bold text-brand">{comp.title}</td>
                <td className="p-4 text-slate-600 font-semibold">{comp.companyId?.name || 'N/A'}</td>
                <td className="p-4 text-slate-600 font-semibold">{comp.experienceRequired}</td>
                <td className="p-4 text-slate-600">{comp.createdBy?.firstname} {comp.createdBy?.lastname}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => triggerConfirm(comp)}
                    className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {filteredChallenges.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">No challenges published.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={filteredChallenges.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {selectedComp && (
        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => {
            setConfirmOpen(false);
            setSelectedComp(null);
          }}
          onConfirm={() => handleDeleteCompetition(selectedComp.id)}
          actionName="Delete Challenge"
          targetName={selectedComp.title}
          targetId={getCanonicalId('challenge', selectedComp.id)}
          consequenceText="This will permanently delete the hiring challenge and remove it from all candidate directories. Candidates already enrolled will lose access to submit solutions."
          isDestructive={true}
          requireTypeMatch={true}
        />
      )}
    </div>
  );
}
