import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, CircleDot } from 'lucide-react';

interface StatusTagProps {
  status: string;
}

export const StatusTag: React.FC<StatusTagProps> = ({ status }) => {
  const s = status.toLowerCase();

  if (
    s === 'paid' ||
    s === 'verified' ||
    s === 'completed' ||
    s === 'available' ||
    s === 'approved' ||
    s === 'administered' ||
    s === 'healthy' ||
    s === 'active' ||
    s === 'present' ||
    s === 'discharged' ||
    s === 'settled' ||
    s === 'used'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }

  if (
    s === 'partiallypaid' ||
    s === 'inprogress' ||
    s === 'collected' ||
    s === 'processing' ||
    s === 'performed' ||
    s === 'reportdraft' ||
    s === 'submitted' ||
    s === 'underreview' ||
    s === 'allocated' ||
    s === 'processed' ||
    s === 'reserved' ||
    s === 'moderate' ||
    s === 'late' ||
    s === 'onleave'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }

  if (
    s === 'overdue' ||
    s === 'occupied' ||
    s === 'void' ||
    s === 'cancelled' ||
    s === 'rejected' ||
    s === 'missed' ||
    s === 'high' ||
    s === 'nicu' ||
    s === 'terminated' ||
    s === 'absent' ||
    s === 'maintenance'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded whitespace-nowrap">
        {s === 'high' || s === 'overdue' || s === 'nicu' ? (
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        ) : (
          <XCircle className="w-3.5 h-3.5 shrink-0" />
        )}
        <span>{status}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded whitespace-nowrap">
      <CircleDot className="w-3.5 h-3.5 shrink-0" />
      <span>{status}</span>
    </span>
  );
};
