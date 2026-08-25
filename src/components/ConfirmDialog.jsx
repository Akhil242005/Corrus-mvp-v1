'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  actionName, // e.g. "Deactivate"
  targetName, // e.g. "Akhil A"
  consequenceText, // e.g. "This will revoke their platform access immediately."
  isDestructive = true,
  requireTypeMatch = false,
  targetId = ''
}) {
  const [typedInput, setTypedInput] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const matchPhrase = targetId || targetName;
  const isMatchValid = !requireTypeMatch || typedInput.trim() === matchPhrase.trim();

  const handleConfirm = () => {
    onConfirm();
    setTypedInput('');
    onClose();
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-[10px] flex items-center justify-center overflow-y-auto py-8 px-4 z-50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl p-6 w-full max-w-md relative animate-modal max-h-[90vh] overflow-y-auto my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-2xl text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          ×
        </button>

        <h3 className="text-lg font-bold text-slate-900 mb-2">
          {actionName} "{targetName}"?
        </h3>

        <p className="text-sm text-slate-500 mb-5 leading-relaxed">
          {consequenceText}
        </p>

        {requireTypeMatch && (
          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Type <span className="font-mono text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded select-all">{matchPhrase}</span> to confirm:
            </label>
            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder={`Enter "${matchPhrase}"`}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition"
            />
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            onClick={() => {
              setTypedInput('');
              onClose();
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={requireTypeMatch && !isMatchValid}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition cursor-pointer shadow-sm text-white disabled:opacity-40 disabled:cursor-not-allowed ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-brand hover:bg-brand-hover'
            }`}
          >
            Confirm {actionName}
          </button>
        </div>
      </div>
    </div>
  );

  return mounted ? createPortal(modalContent, document.body) : null;
}
