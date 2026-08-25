'use client';

import { useContext, useState, useEffect } from 'react';
import { AdminContext } from '../../layout';
import CanonicalTag from '@/components/CanonicalTag';
import SearchFilterBar from '@/components/SearchFilterBar';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getCanonicalId } from '@/lib/idMapper';
import Pagination from '@/components/Pagination';

export default function EmployeesPage() {
  const { employees, companies, handleDeleteUser } = useContext(AdminContext);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ company: [] });

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
    }
  ];

  // Confirmation States
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);

  const triggerConfirm = (emp) => {
    setSelectedEmp(emp);
    setConfirmOpen(true);
  };

  // Filter employees list client-side
  const filteredEmployees = employees.filter((emp) => {
    const canonicalId = getCanonicalId('employee', emp.id);
    const fullname = `${emp.firstname} ${emp.lastname}`.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      fullname.includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      canonicalId.toLowerCase().includes(searchQuery.toLowerCase());

    const selectedCompanies = selectedFilters.company || [];
    const matchesCompany =
      selectedCompanies.length === 0 ||
      selectedCompanies.includes(emp.companyId?.id?.toString());

    return matchesSearch && matchesCompany;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEmployees = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 capitalize">Corporate Employees Directory</h1>
        <p className="text-sm text-slate-500">Manage verified company representatives and control organization workspace credentials.</p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by name, email, or Employee ID (e.g. EMP-XXXXX)..."
        categories={categories}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
        onClear={() => {
          setSearchQuery('');
          setSelectedFilters({ company: [] });
        }}
      />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
              <th className="p-4 font-bold">Employee ID</th>
              <th className="p-4 font-bold">Name</th>
              <th className="p-4 font-bold">Corporate Email</th>
              <th className="p-4 font-bold">Company Workspace</th>
              <th className="p-4 font-bold">Role</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentEmployees.map((emp) => (
              <tr key={emp.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4">
                  <CanonicalTag type="employee" id={emp.id} />
                </td>
                <td className="p-4 font-bold text-brand">{emp.firstname} {emp.lastname}</td>
                <td className="p-4 text-slate-600 font-semibold">{emp.email}</td>
                <td className="p-4 text-slate-600 font-semibold">{emp.companyId?.name || 'N/A'}</td>
                <td className="p-4">
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full select-none">
                    Employee
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => triggerConfirm(emp)}
                    className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">No company members matching the criteria found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={filteredEmployees.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {selectedEmp && (
        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => {
            setConfirmOpen(false);
            setSelectedEmp(null);
          }}
          onConfirm={() => handleDeleteUser(selectedEmp.id)}
          actionName="Deactivate"
          targetName={`${selectedEmp.firstname} ${selectedEmp.lastname}`}
          targetId={getCanonicalId('employee', selectedEmp.id)}
          consequenceText="This will revoke their corporate platform access immediately. The representative will not be able to log in or manage challenges under this workspace."
          isDestructive={true}
          requireTypeMatch={true}
        />
      )}
    </div>
  );
}
