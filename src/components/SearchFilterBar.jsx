'use client';

import { useState, useEffect, useRef } from 'react';

const DEFAULT_CATEGORIES = [];
const DEFAULT_SELECTED_FILTERS = {};

export default function SearchFilterBar({
  searchQuery,
  onSearchChange,
  placeholder = 'Search...',
  categories = DEFAULT_CATEGORIES,
  selectedFilters = DEFAULT_SELECTED_FILTERS,
  onFilterChange,
  onClear
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempFilters, setTempFilters] = useState({ ...selectedFilters });
  const popoverRef = useRef(null);

  // Sync temp filters when selectedFilters changes from outside (e.g., cleared)
  useEffect(() => {
    setTempFilters({ ...selectedFilters });
  }, [selectedFilters]);

  // Click outside to close popover
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Count active selections
  const activeFiltersCount = Object.values(selectedFilters).reduce(
    (acc, valArray) => acc + (valArray ? valArray.length : 0),
    0
  ) + (searchQuery ? 1 : 0);

  const handleCheckboxChange = (catKey, optionVal) => {
    const currentSelected = tempFilters[catKey] || [];
    let updated;
    if (currentSelected.includes(optionVal)) {
      updated = currentSelected.filter((v) => v !== optionVal);
    } else {
      updated = [...currentSelected, optionVal];
    }
    setTempFilters({
      ...tempFilters,
      [catKey]: updated
    });
  };

  const handleApply = () => {
    onFilterChange(tempFilters);
    setIsOpen(false);
  };

  const handleClear = () => {
    const cleared = {};
    categories.forEach((cat) => {
      cleared[cat.key] = [];
    });
    setTempFilters(cleared);
    onFilterChange(cleared);
    onClear(); // trigger parent search query clear
    setIsOpen(false);
  };

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm flex flex-col gap-3 relative z-20">
      <div className="flex items-center justify-between gap-4">
        {/* Search Input */}
        <div className="flex-1 relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none">🔍</span>
          <input
            type="text"
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 outline-none glow-input font-medium"
          />
        </div>

        {/* Filters Button */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`px-4 py-2 border rounded-lg text-xs font-extrabold flex items-center gap-2 cursor-pointer transition-all duration-150 select-none shadow-sm ${
              isOpen || activeFiltersCount > 0
                ? 'bg-brand text-white border-brand hover:bg-brand-hover shadow-brand/10'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>⚙️ Filters</span>
            {activeFiltersCount > 0 && (
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full transition-all ${
                isOpen || activeFiltersCount > 0
                  ? 'bg-white text-brand'
                  : 'bg-brand text-white'
              }`}>
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Floating Dropdown Popover */}
          {isOpen && (
            <div className="absolute right-0 mt-2.5 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-5 flex flex-col gap-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-1">
                <span className="text-xs font-bold text-slate-900">Filter Options</span>
                <button
                  onClick={handleClear}
                  className="text-[11px] font-extrabold text-brand-danger hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              {/* Scrollable Categories List */}
              <div className="flex flex-col gap-4 max-h-[260px] overflow-y-auto pr-1">
                {categories.map((cat) => (
                  <div key={cat.key} className="flex flex-col gap-2">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                      {cat.label}
                    </span>
                    <div className="flex flex-col gap-2 pl-1">
                      {cat.options.map((opt) => {
                        const isChecked = (tempFilters[cat.key] || []).includes(opt.value);
                        return (
                          <label
                            key={opt.value}
                            className="flex items-center gap-2.5 text-xs text-slate-700 font-semibold cursor-pointer select-none py-0.5 hover:text-slate-900 transition"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleCheckboxChange(cat.key, opt.value)}
                              className="w-4 h-4 accent-brand border-slate-300 rounded cursor-pointer transition-all"
                            />
                            <span>{opt.label}</span>
                          </label>
                        );
                      })}
                      {cat.options.length === 0 && (
                        <span className="text-xs text-slate-400 font-medium">No options available.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Popover Footer Buttons */}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3.5 mt-1">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleApply}
                  className="px-4.5 py-1.5 bg-brand hover:bg-brand-hover text-white text-xs font-extrabold rounded-lg transition cursor-pointer shadow-md shadow-brand/10"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
