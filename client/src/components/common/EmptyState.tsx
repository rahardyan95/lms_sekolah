import React from 'react';
import { AlertCircle } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  message: string;
  testId: string;
}

/** Status kosong eksplisit: lebih baik "belum ada data" daripada angka/baris karangan. */
export const EmptyState: React.FC<EmptyStateProps> = ({ title, message, testId }) => (
  <div
    className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs text-center"
    data-testid={testId}
  >
    <AlertCircle className="w-6 h-6 mx-auto text-slate-400" aria-hidden="true" />
    <p className="mt-2 text-sm font-bold text-slate-800">{title}</p>
    <p className="mt-1 text-xs text-slate-500">{message}</p>
  </div>
);
