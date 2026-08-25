'use client';

import { useContext, useState, useEffect } from 'react';
import { AdminContext } from '../layout';
import SearchFilterBar from '@/components/SearchFilterBar';
import Pagination from '@/components/Pagination';

export default function AuditLogsPage() {
  const { auditLogs } = useContext(AdminContext);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilters, setSelectedFilters] = useState({ action: [] });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; // Show 20 logs per page

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedFilters]);

  // Extract unique action types for filter options
  const uniqueActions = [];
  auditLogs.forEach((log) => {
    if (log.action && !uniqueActions.includes(log.action)) {
      uniqueActions.push(log.action);
    }
  });

  const categories = [
    {
      key: 'action',
      label: 'Filter by Action',
      options: uniqueActions.map((act) => ({
        value: act,
        label: act
      }))
    }
  ];

  // Filter logs client-side
  const filteredLogs = auditLogs.filter((log) => {
    const actorInfo = `${log.performedByName} ${log.performedByEmail}`.toLowerCase();
    const matchesSearch =
      searchQuery === '' ||
      actorInfo.includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details && log.details.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.targetType && log.targetType.toLowerCase().includes(searchQuery.toLowerCase()));

    const selectedActions = selectedFilters.action || [];
    const matchesAction = selectedActions.length === 0 || selectedActions.includes(log.action);

    return matchesSearch && matchesAction;
  });

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLogs = filteredLogs.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 capitalize">Audit Logging Feed</h1>
        <p className="text-sm text-slate-500">Trace system access events, credential verification checkouts, and admin actions.</p>
      </div>

      <SearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search logs by actor, action keyword, target, or details..."
        categories={categories}
        selectedFilters={selectedFilters}
        onFilterChange={setSelectedFilters}
        onClear={() => {
          setSearchQuery('');
          setSelectedFilters({ action: [] });
        }}
      />

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400 sticky top-0">
                <th className="p-4 font-bold">Timestamp</th>
                <th className="p-4 font-bold">Action</th>
                <th className="p-4 font-bold">Performed By (User/Admin)</th>
                <th className="p-4 font-bold">Target Type</th>
                <th className="p-4 font-bold">Description Details</th>
              </tr>
            </thead>
            <tbody>
              {currentLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 text-xs">
                  <td className="p-4 text-slate-500 font-semibold">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-4 font-bold text-brand">{log.action}</td>
                  <td className="p-4 text-slate-700 font-semibold">
                    {log.performedByName} <br />
                    <span className="text-[10px] text-slate-400 font-normal">{log.performedByEmail}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full select-none">
                      {log.targetType}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 font-semibold whitespace-pre-wrap">
                    {log.details}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                    No matching audit logs found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={filteredLogs.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
