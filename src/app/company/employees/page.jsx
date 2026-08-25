'use client';

import { useContext, useState, useEffect } from 'react';
import { CompanyContext } from '../layout';
import CanonicalTag from '@/components/CanonicalTag';
import SearchFilterBar from '@/components/SearchFilterBar';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getCanonicalId } from '@/lib/idMapper';
import Pagination from '@/components/Pagination';
import { createPortal } from 'react-dom';

export default function WorkspaceEmployees() {
  const {
    employees,
    userRole,
    handleToggleEmployeeApprove,
    handleAddEmployee
  } = useContext(CompanyContext);

  if (userRole && userRole !== 'company_admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl shadow-sm text-center animate-fade-in">
        <span className="text-3xl mb-3">⚠️</span>
        <h1 className="text-lg font-black text-slate-800 tracking-tight">Access Denied</h1>
        <p className="text-xs text-slate-500 font-semibold mt-1">This page is restricted to corporate workspace administrators only.</p>
      </div>
    );
  }

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ status: [] });

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
      key: 'status',
      label: 'Access Status',
      options: [
        { value: 'approved', label: 'Approved Access' },
        { value: 'revoked', label: 'Access Revoked' }
      ]
    }
  ];

  // Register Employee Modal State
  const [isAddingEmp, setIsAddingEmp] = useState(false);
  const [empFirstname, setEmpFirstname] = useState('');
  const [empLastname, setEmpLastname] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [createdTempPassword, setCreatedTempPassword] = useState('');
  const [createdEmail, setCreatedEmail] = useState('');
  const [empError, setEmpError] = useState('');
  const [empSuccess, setEmpSuccess] = useState('');

  const closeEmployeeModal = () => {
    setCreatedTempPassword('');
    setCreatedEmail('');
    setEmpSuccess('');
    setEmpError('');
    setIsAddingEmp(false);
  };

  // Confirmation state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);

  const onSubmitEmployee = async (e) => {
    e.preventDefault();
    setEmpError('');
    setEmpSuccess('');

    if (!empFirstname.trim() || !empEmail.trim()) {
      setEmpError('First name and email are required');
      return;
    }

    const res = await handleAddEmployee(empFirstname, empLastname, empEmail, empPhone);
    if (res.success) {
      setCreatedTempPassword(res.tempPassword);
      setCreatedEmail(empEmail);
      setEmpSuccess('Corporate employee registered successfully!');
      setEmpFirstname('');
      setEmpLastname('');
      setEmpEmail('');
      setEmpPhone('');
    } else {
      setEmpError(res.error || 'Failed to create employee');
    }
  };

  const triggerToggleApproveConfirm = (emp) => {
    setSelectedEmp(emp);
    setConfirmOpen(true);
  };

  // Filter employees client-side
  const filteredEmployees = employees.filter((emp) => {
    const canonicalId = getCanonicalId('employee', emp.id);
    const fullname = `${emp.firstname} ${emp.lastname}`.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      fullname.includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      canonicalId.toLowerCase().includes(searchQuery.toLowerCase());

    const selectedStatus = selectedFilters.status || [];
    const matchesStatus =
      selectedStatus.length === 0 ||
      (selectedStatus.includes('approved') && emp.isApproved) ||
      (selectedStatus.includes('revoked') && !emp.isApproved);

    return matchesSearch && matchesStatus;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEmployees = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Member Management</h1>
          <p className="text-xs font-semibold text-slate-400 mt-1">Register corporate users and audit workspace permissions.</p>
        </div>
        {userRole === 'company_admin' && (
          <button
            onClick={() => setIsAddingEmp(true)}
            className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
          >
            <span>➕</span> Register Employee
          </button>
        )}
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search employees by name, email, or ID (e.g. EMP-0001)..."
        categories={categories}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
        onClear={() => {
          setSearchQuery('');
          setSelectedFilters({ status: [] });
        }}
      />

      {/* Table Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200/80 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                <th className="p-4 pl-6">Employee ID</th>
                <th className="p-4">Full Name</th>
                <th className="p-4">Corporate Email</th>
                <th className="p-4">Mobile Phone</th>
                <th className="p-4">Access Status</th>
                {userRole === 'company_admin' && <th className="p-4 pr-6 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentEmployees.map((emp) => (
                <tr key={emp.id} className="interactive-row hover:bg-slate-50/50">
                  <td className="p-4 pl-6">
                    <CanonicalTag type="employee" id={emp.id} />
                  </td>
                  <td className="p-4 font-black text-slate-900 text-sm">{emp.firstname} {emp.lastname}</td>
                  <td className="p-4 text-slate-500 font-semibold">{emp.email}</td>
                  <td className="p-4 text-slate-500 font-medium">{emp.phone || '—'}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-extrabold border px-2.5 py-0.5 rounded-full select-none ${
                      emp.isApproved
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60'
                        : 'bg-rose-50 text-rose-600 border-rose-200/60'
                    }`}>
                      {emp.isApproved ? 'Approved Access' : 'Access Revoked'}
                    </span>
                  </td>
                  {userRole === 'company_admin' && (
                    <td className="p-4 pr-6 text-right">
                      <button
                        onClick={() => triggerToggleApproveConfirm(emp)}
                        className={`px-3.5 py-1.5 text-[10px] font-extrabold rounded-lg border transition cursor-pointer ${
                          emp.isApproved
                            ? 'bg-rose-50 border-rose-100 hover:bg-rose-100 text-rose-600'
                            : 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100 text-emerald-600'
                        }`}
                      >
                        {emp.isApproved ? 'Revoke Access' : 'Approve User'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {currentEmployees.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-slate-400 font-semibold text-sm">
                    No corporate employees registered under this workspace.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={filteredEmployees.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* Add Employee Modal Form overlay */}
      {mounted && isAddingEmp && createPortal(
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[10px] flex items-center justify-center overflow-y-auto py-8 px-4 z-50 animate-fade-in" onClick={closeEmployeeModal}>
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 w-full max-w-lg relative animate-modal max-h-[90vh] overflow-y-auto my-auto" onClick={(e) => e.stopPropagation()}>
            <button onClick={closeEmployeeModal} className="absolute top-4 right-5 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer">×</button>
            
            <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2.5 mb-6 uppercase tracking-wider">
              Register Workspace Employee
            </h3>

            {createdTempPassword ? (
              <div className="flex flex-col gap-5 text-xs text-slate-700">
                <div className="p-5 bg-emerald-50 border border-emerald-250/60 rounded-xl text-emerald-900">
                  <h4 className="font-extrabold text-sm mb-2 flex items-center gap-1.5">
                    <span>🎉</span> Employee Registered successfully!
                  </h4>
                  <p className="text-slate-500 mb-4 leading-relaxed text-[11px]">
                    A secure temporary password has been successfully generated. Provide these credentials to the employee to execute their first-time password setup.
                  </p>
                  
                  <div className="flex flex-col gap-3 bg-white border border-slate-200/80 p-4 rounded-xl shadow-inner">
                    <div>
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide block">Employee Account</span>
                      <span className="font-bold text-slate-800 font-mono text-xs">{createdEmail}</span>
                    </div>
                    <div className="border-t border-slate-100 pt-2.5 mt-1">
                      <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wide block">Temporary Password</span>
                      <span className="font-bold text-brand font-mono text-sm select-all bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-lg block mt-1.5 text-center tracking-wide">
                        {createdTempPassword}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-rose-600 text-[9px] font-extrabold mt-4 uppercase tracking-widest text-center">
                    ⚠️ Warning: This password cannot be displayed again!
                  </p>
                </div>

                <div className="flex justify-end gap-3 mt-1.5">
                  <button
                    type="button"
                    onClick={closeEmployeeModal}
                    className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white font-extrabold rounded-xl shadow-md transition cursor-pointer shadow-brand/10"
                  >
                    Done & Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmitEmployee} className="flex flex-col gap-4 text-xs text-slate-700">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">First Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. John"
                      value={empFirstname}
                      onChange={(e) => setEmpFirstname(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">Last Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Doe"
                      value={empLastname}
                      onChange={(e) => setEmpLastname(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">Corporate Email *</label>
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-medium"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide block mb-1">Mobile Phone (10-digit)</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    maxLength={10}
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-slate-800 bg-slate-50/50 outline-none glow-input font-medium"
                  />
                </div>

                {empError && <p className="text-xs font-bold text-rose-500">{empError}</p>}
                {empSuccess && <p className="text-xs font-bold text-emerald-500">{empSuccess}</p>}

                <div className="flex justify-end gap-3 mt-4 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={closeEmployeeModal}
                    className="px-5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold rounded-xl border border-slate-200 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white font-extrabold rounded-xl shadow-md transition cursor-pointer shadow-brand/10"
                  >
                    Create Account
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {selectedEmp && (
        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => {
            setConfirmOpen(false);
            setSelectedEmp(null);
          }}
          onConfirm={() => handleToggleEmployeeApprove(selectedEmp.id, !selectedEmp.isApproved)}
          actionName={selectedEmp.isApproved ? 'Revoke Access' : 'Approve User'}
          targetName={`${selectedEmp.firstname} ${selectedEmp.lastname}`}
          targetId={getCanonicalId('employee', selectedEmp.id)}
          consequenceText={
            selectedEmp.isApproved
              ? 'This will immediately revoke their workspace credentials, preventing them from accessing corporate challenges.'
              : 'This will approve their representative access and enable them to login and verify candidate coding solutions.'
          }
          isDestructive={selectedEmp.isApproved}
        />
      )}
    </div>
  );
}
