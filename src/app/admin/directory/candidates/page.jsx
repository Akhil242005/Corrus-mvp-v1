'use client';

import { useContext, useState, useEffect } from 'react';
import { AdminContext } from '../../layout';
import CanonicalTag from '@/components/CanonicalTag';
import SearchFilterBar from '@/components/SearchFilterBar';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getCanonicalId } from '@/lib/idMapper';
import Pagination from '@/components/Pagination';

export default function CandidatesPage() {
  const { users, handleChangeRole, handleDeleteUser } = useContext(AdminContext);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ role: [] });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilters]);

  const categories = [
    {
      key: 'role',
      label: 'Filter by Role',
      options: [
        { value: 'user', label: 'User / Candidate' },
        { value: 'admin', label: 'Admin / Manager' }
      ]
    }
  ];

  // Confirmation States
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionType, setActionType] = useState(null); // 'role' or 'delete'

  const triggerConfirm = (user, type) => {
    setSelectedUser(user);
    setActionType(type);
    setConfirmOpen(true);
  };

  const handleExecuteAction = () => {
    if (!selectedUser || !actionType) return;
    if (actionType === 'role') {
      handleChangeRole(selectedUser.id, selectedUser.role);
    } else if (actionType === 'delete') {
      handleDeleteUser(selectedUser.id);
    }
  };

  // Filter candidates list client-side
  const filteredUsers = users.filter((u) => {
    const canonicalId = getCanonicalId('candidate', u.id);
    const fullname = `${u.firstname} ${u.lastname}`.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      fullname.includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      canonicalId.toLowerCase().includes(searchQuery.toLowerCase());

    const selectedRoles = selectedFilters.role || [];
    const matchesRole = selectedRoles.length === 0 || selectedRoles.includes(u.role);

    return matchesSearch && matchesRole;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 capitalize">Candidates Directory</h1>
        <p className="text-sm text-slate-500">View registered candidates, toggle system roles, and de-authenticate profiles.</p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search by name, email, or Candidate ID (e.g. CND-XXXXX)..."
        categories={categories}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
        onClear={() => {
          setSearchQuery('');
          setSelectedFilters({ role: [] });
        }}
      />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
              <th className="p-4 font-bold">Candidate ID</th>
              <th className="p-4 font-bold">Name</th>
              <th className="p-4 font-bold">Email</th>
              <th className="p-4 font-bold">Phone</th>
              <th className="p-4 font-bold">Current Role</th>
              <th className="p-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-4">
                  <CanonicalTag type="candidate" id={u.id} />
                </td>
                <td className="p-4 font-bold text-brand">{u.firstname} {u.lastname}</td>
                <td className="p-4 text-slate-600 font-semibold">{u.email}</td>
                <td className="p-4 text-slate-600">{u.phone || 'N/A'}</td>
                <td className="p-4">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full select-none capitalize ${
                    u.role === 'admin' 
                      ? 'bg-purple-50 text-purple-600 border border-purple-200' 
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-4 text-right flex items-center justify-end gap-2">
                  <button
                    onClick={() => triggerConfirm(u, 'role')}
                    className="px-2.5 py-1 bg-brand/10 hover:bg-brand/15 text-brand text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    Toggle Admin
                  </button>
                  <button
                    onClick={() => triggerConfirm(u, 'delete')}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">No candidates matching the criteria found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={filteredUsers.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {selectedUser && (
        <ConfirmDialog
          isOpen={confirmOpen}
          onClose={() => {
            setConfirmOpen(false);
            setSelectedUser(null);
            setActionType(null);
          }}
          onConfirm={handleExecuteAction}
          actionName={actionType === 'role' ? 'Toggle Admin Role for' : 'Deactivate'}
          targetName={`${selectedUser.firstname} ${selectedUser.lastname}`}
          targetId={getCanonicalId('candidate', selectedUser.id)}
          consequenceText={
            actionType === 'role'
              ? `This will grant or revoke administrator platform access. Current role is "${selectedUser.role}".`
              : 'This will revoke their platform access immediately. The user will be blocked from logging in.'
          }
          isDestructive={actionType === 'delete'}
          requireTypeMatch={actionType === 'delete'}
        />
      )}
    </div>
  );
}
