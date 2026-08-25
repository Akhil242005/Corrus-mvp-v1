'use client';

import { useState } from 'react';
import { getCanonicalId } from '@/lib/idMapper';

export default function CanonicalTag({ type, id }) {
  const [copied, setCopied] = useState(false);
  
  if (!id) return null;
  const canonicalId = getCanonicalId(type, id);

  const handleCopy = (e) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(canonicalId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-2 py-0.5 rounded transition duration-150 relative group select-none">
      <span>{canonicalId}</span>
      <button
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 cursor-pointer transition-opacity duration-150 focus:opacity-100 ml-0.5 text-[9px]"
        title="Copy ID"
      >
        {copied ? '✓' : '📋'}
      </button>
      {copied && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap animate-fade-in font-sans">
          Copied!
        </span>
      )}
    </span>
  );
}
