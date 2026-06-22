'use client';

import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Corpo del messaggio (può andare a capo: viene reso preservando i \n). */
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** Disabilita i pulsanti e mostra lo stato "in corso". */
  busy?: boolean;
  /** Stile distruttivo (rosso) per le azioni irreversibili o di eliminazione. */
  danger?: boolean;
}

/**
 * Dialog di conferma riutilizzabile (Headless UI). Sostituisce il `confirm()` nativo:
 * accessibile, coerente col tema chiaro/scuro, con corpo testuale multi-riga.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={busy ? () => {} : onCancel} className="relative z-50">
      <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl p-6">
          <DialogTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </DialogTitle>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
            {message}
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`px-3 py-1.5 text-sm rounded-md text-white disabled:opacity-50 ${
                danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:opacity-90'
              }`}
            >
              {busy ? '…' : confirmLabel}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
