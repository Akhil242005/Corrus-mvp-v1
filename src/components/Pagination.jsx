'use client';

export default function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;

  return (
    <div className="w-full flex items-center justify-between border-t border-slate-200/80 pt-4 mt-6 select-none">
      <span className="text-xs text-slate-500 font-bold">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex gap-2.5">
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-xs font-black rounded-lg shadow-sm cursor-pointer select-none transition"
        >
          Previous
        </button>
        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 text-xs font-black rounded-lg shadow-sm cursor-pointer select-none transition"
        >
          Next
        </button>
      </div>
    </div>
  );
}
