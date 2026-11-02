import React, { useState } from 'react';
import { User, Eye, EyeOff, ShieldCheck, ChevronRight } from 'lucide-react';
import CooldownIndicator from './CooldownIndicator';

export default function StudentCard({ student, cooldown, onSelectStudent }) {
  const [unmasked, setUnmasked] = useState(false);

  // Mask UID: e.g. "•••• ••D4" or "A1B2C3D4"
  const rawUid = student.rfidUid || '';
  const maskedUid =
    rawUid.length >= 4 ? `•••• ••${rawUid.slice(-2)}` : '••••••••';
  const displayUid = unmasked ? rawUid : maskedUid;

  // Format last successful scan
  const formatTime = (ts) => {
    if (!ts) return 'Never scanned';
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const lastScanText = formatTime(
    student.lastAttendanceTimestamp || (student.lastAttendance && student.lastAttendance.timestamp)
  );

  return (
    <div
      onClick={() => onSelectStudent && onSelectStudent(student)}
      className="group relative bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
    >
      <div>
        {/* Header: Student Name & Reg Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-blue-50 text-slate-700 group-hover:text-blue-600 flex items-center justify-center transition-colors">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                {student.name}
              </h4>
              <p className="text-xs text-slate-500 font-mono">{student.studentId}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3 h-3" />
            Active
          </span>
        </div>

        {/* UID & Reveal button */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">RFID UID:</span>
          <div className="flex items-center gap-1.5 font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded border border-slate-200/60">
            <span>{displayUid}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setUnmasked(!unmasked);
              }}
              className="text-slate-400 hover:text-slate-600 transition-colors ml-1 p-0.5"
              title={unmasked ? 'Mask UID' : 'Reveal UID'}
            >
              {unmasked ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Last Successful Scan */}
        <div className="mt-2.5 flex items-center justify-between text-xs">
          <span className="text-slate-500">Last Attendance:</span>
          <span className="font-medium text-slate-700">{lastScanText}</span>
        </div>
      </div>

      {/* Cooldown Section & Quick Action */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
        <CooldownIndicator
          remainingSeconds={cooldown ? cooldown.remainingSeconds : 0}
          isCooldownActive={cooldown ? cooldown.isCooldownActive : false}
        />

        <div className="flex items-center justify-end text-[11px] text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform">
          <span>View card history</span>
          <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
        </div>
      </div>
    </div>
  );
}
