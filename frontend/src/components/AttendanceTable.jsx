import React from 'react';
import { CalendarCheck, ShieldCheck, Inbox } from 'lucide-react';

export default function AttendanceTable({ entries, loading }) {
  const formatTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (dateStr, ts) => {
    if (dateStr) return dateStr;
    if (ts) return new Date(ts).toISOString().split('T')[0];
    return 'Today';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Card Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Today's Attendance</h3>
            <p className="text-xs text-slate-500">Live verified entries stored in MongoDB</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
          {entries.length} Present
        </span>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/70 text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-100">
              <th className="py-3 px-4">No.</th>
              <th className="py-3 px-4">Student Name</th>
              <th className="py-3 px-4">Student ID</th>
              <th className="py-3 px-4">RFID UID</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Time</th>
              <th className="py-3 px-4 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Loading attendance records...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center">
                    <Inbox className="w-8 h-8 text-slate-300 mb-2 stroke-[1.5]" />
                    <p className="text-sm font-medium text-slate-600">No attendance marked today</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tap a registered RFID card on RC522 or click a simulation button above.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              entries.map((entry, index) => (
                <tr
                  key={entry._id || `att-${index}`}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-slate-400">{index + 1}</td>
                  <td className="py-3 px-4 font-semibold text-slate-900">
                    {entry.studentName || (entry.student && entry.student.name)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {entry.studentId || (entry.student && entry.student.studentId)}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 bg-slate-50/50">
                    {entry.rfidUid}
                  </td>
                  <td className="py-3 px-4 text-slate-600">
                    {formatDate(entry.date, entry.timestamp)}
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-slate-700">
                    {formatTime(entry.timestamp)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <ShieldCheck className="w-3 h-3" />
                      Present
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
