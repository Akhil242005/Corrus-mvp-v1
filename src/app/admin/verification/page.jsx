'use client';

import { useContext, useState } from 'react';
import { AdminContext } from '../layout';
import ConfirmDialog from '@/components/ConfirmDialog';
import Pagination from '@/components/Pagination';

export default function VerificationPage() {
  const { companies, handleVerifyCompany } = useContext(AdminContext);
  
  // Confirmation state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const triggerVerifyConfirm = (comp) => {
    setSelectedCompany(comp);
    setConfirmOpen(true);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCompanies = companies.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 capitalize">Workspace Verification</h1>
        <p className="text-sm text-slate-500">Platform governance panel, workspace rollouts, and audit checks.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
              <th className="p-4 font-bold">Company Name</th>
              <th className="p-4 font-bold">HQ location</th>
              <th className="p-4 font-bold">Admin Email</th>
              <th className="p-4 font-bold">Status Badge</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentCompanies.map(comp => (
              <tr key={comp.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4 font-bold text-brand">{comp.name}</td>
                <td className="p-4 text-slate-600 font-semibold">{comp.place}</td>
                <td className="p-4 text-slate-600 font-semibold">{comp.adminId?.email || 'N/A'}</td>
                <td className="p-4">
                  <span className={`text-[11px] font-extrabold border px-2 py-0.5 rounded-full select-none ${
                    comp.isVerified
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : 'bg-amber-50 text-amber-600 border-amber-200'
                  }`}>
                    {comp.isVerified ? '✓ Verified' : '⏳ Pending'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => triggerVerifyConfirm(comp)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                      comp.isVerified
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    {comp.isVerified ? 'Revoke Verification' : 'Verify Company'}
                  </button>
                </td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                  No corporate workspaces registered on this platform.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={companies.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {selectedCompany && (
        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => {
            setConfirmOpen(false);
            setSelectedCompany(null);
          }}
          onConfirm={() => handleVerifyCompany(selectedCompany.id, !selectedCompany.isVerified)}
          actionName={selectedCompany.isVerified ? 'Revoke Verification for' : 'Verify'}
          targetName={selectedCompany.name}
          consequenceText={
            selectedCompany.isVerified
              ? 'This will revoke all active verification privileges, preventing members from publishing new challenges.'
              : 'This will approve the corporate workspace and allow authorized employees to publish active hiring challenges.'
          }
          isDestructive={selectedCompany.isVerified}
        />
      )}
    </div>
  );
}
