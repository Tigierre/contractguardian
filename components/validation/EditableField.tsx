'use client';

import { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import { ConfidenceBadge } from './ConfidenceBadge';

type ConfidenceLevel = 'high' | 'medium' | 'low';

interface EditableFieldProps {
  label: string;
  value: string | null;
  confidence: ConfidenceLevel;
  reasoning: string;
  type: 'text' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
  confirmed: boolean;
  onConfirm: (value: string | null) => void;
  onEdit: (value: string | null) => void;
}

export function EditableField({
  label,
  value,
  confidence,
  reasoning,
  type,
  options = [],
  placeholder = '',
  confirmed,
  onConfirm,
  onEdit,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (isEditing && type === 'text' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing, type]);

  const handleEnterEdit = () => {
    setEditValue(value ?? '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditValue(value ?? '');
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    const newValue = editValue.trim() === '' ? null : editValue.trim();
    onEdit(newValue);
    setIsEditing(false);
  };

  const handleConfirm = () => {
    onConfirm(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type === 'text') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setEditValue(newValue);
    onEdit(newValue);
    setIsEditing(false);
  };

  // Determine if this field should be highlighted (low confidence and not confirmed)
  const shouldHighlight = confidence === 'low' && !confirmed;

  return (
    <div
      className={clsx(
        'rounded-lg border p-4 transition-all duration-200',
        confirmed
          ? 'border-l-4 border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10 border-slate-200 dark:border-slate-700'
          : shouldHighlight
          ? 'border-2 border-rose-300 dark:border-rose-700'
          : 'border-slate-200 dark:border-slate-700'
      )}
    >
      {/* Header: Label + Badge */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </label>
        <ConfidenceBadge level={confidence} />
      </div>

      {/* Value display / edit */}
      <div className="mb-2">
        {isEditing ? (
          // Edit mode
          <div className="flex gap-2 items-center">
            {type === 'text' ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            ) : (
              <select
                ref={selectRef}
                value={editValue}
                onChange={handleSelectChange}
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md text-sm font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
            {type === 'text' && (
              <>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="p-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                  title="Salva"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  title="Annulla"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </div>
        ) : (
          // View mode
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              {value ? (
                <p className={clsx(
                  'text-sm font-medium',
                  confirmed ? 'text-slate-600 dark:text-slate-300' : 'text-slate-900 dark:text-slate-100'
                )}>
                  {type === 'select' ? options.find(o => o.value === value)?.label ?? value : value}
                </p>
              ) : (
                <p className="text-sm font-medium text-slate-400 dark:text-slate-500 italic">
                  {placeholder || 'Nessun valore'}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {confirmed ? (
                // Confirmed state - show checkmark and allow re-edit
                <>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confermato
                  </span>
                  <button
                    type="button"
                    onClick={handleEnterEdit}
                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                    title="Modifica"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </>
              ) : (
                // Not confirmed - show edit and confirm buttons
                <>
                  <button
                    type="button"
                    onClick={handleEnterEdit}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                    title="Modifica"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded hover:bg-emerald-700 transition-colors"
                  >
                    OK
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* AI Reasoning - always visible */}
      <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-1">
        {reasoning}
      </p>
    </div>
  );
}
