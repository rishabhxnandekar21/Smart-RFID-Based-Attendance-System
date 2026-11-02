import React, { useState } from 'react';
import { History, Filter, AlertCircle, CheckCircle, RefreshCcw } from 'lucide-react';

export default function ScanHistory({ scans, onFilterChange, filterStatus, selectedUid, onUidFilterChange, registeredStudents = [] }) {
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

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3 h-3" />
            Success
          </span>
        );
      case 'duplicate':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <RefreshCcw className="w-3 h-3" />
            Duplicate
          </span>
        );
      case 'unknown':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3" />
            Unknown
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Header and Filter Controls */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">RFID Scan History</h3>
            <p className="text-xs text-slate-500">Every raw hardware attempt (latest 50)</p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status buttons */}
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
            {['all', 'success', 'duplicate', 'unknown'].map((st) => (
              <button
                key={st}
                onClick={() => onFilterChange(st)}
                className={`px-2.5 py-1 rounded-md capitalize transition-colors ${
                  filterStatus === st
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Card Filter Dropdown */}
          <select
            value={selectedUid || ''}
            onChange={(e) => onUidFilterChange(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Cards</option>
            {registeredStudents.map((s) => (
              <option key={s.rfidUid} value={s.rfidUid}>
                {s.name} ({s.rfidUid})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto max-h-[380px]">
        <table className="w-full text-left border-collapse">
          <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-xs z-10">
            <tr className="text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-100">
              <th className="py-2.5 px-4">Student</th>
              <th className="py-2.5 px-4">RFID UID</th>
              <th className="py-2.5 px-4">Device ID</th>
              <th className="py-2.5 px-4">Date</th>
              <th className="py-2.5 px-4">Time</th>
              <th className="py-2.5 px-4 text-right">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {scans.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No scan attempts matching current filter.
                </td>
              </tr>
            ) : (
              scans.map((scan) => (
                <tr key={scan._id || scan.eventId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-semibold text-slate-800">
                    {scan.studentName || 'Unregistered Card'}
                    {scan.studentId && (
                      <span className="ml-1 text-[11px] font-mono text-slate-400">
                        ({scan.studentId})
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-600 bg-slate-50/40">
                    {scan.uid}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-slate-500">
                    {scan.deviceId || 'ESP32_01'}
                  </td>
                  <td className="py-2.5 px-4 text-slate-500">{formatDate(scan.timestamp)}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600">
                    {formatTime(scan.timestamp)}
                  </td>
                  <td className="py-2.5 px-4 text-right">{getStatusBadge(scan.status)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
