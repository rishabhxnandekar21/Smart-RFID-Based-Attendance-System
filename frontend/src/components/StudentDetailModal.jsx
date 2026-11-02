import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Clock, Calendar, Hash, Shield } from 'lucide-react';
import api from '../services/api';

export default function StudentDetailModal({ student, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!student || !student.studentId) return;

    let isMounted = true;
    setLoading(true);

    api
      .getStudentDetail(student.studentId)
      .then((res) => {
        if (isMounted && res.success) {
          setDetail(res.data);
        }
      })
      .catch((err) => console.error('Failed to load student detail:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [student]);

  if (!student) return null;

  // Format helper
  const formatDateTime = (ts) => {
    if (!ts) return { date: 'N/A', time: 'N/A' };
    const d = new Date(ts);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
  };

  const getTimeSince = (ts) => {
    if (!ts) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const lastAttendanceTs =
    detail?.lastAttendance?.timestamp || detail?.lastAttendanceTimestamp || student?.lastAttendanceTimestamp;
  const { date: lastDate, time: lastTime } = formatDateTime(lastAttendanceTs);
  const timeSince = getTimeSince(lastAttendanceTs);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-pop-in">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              {student.name.charAt(0)}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{student.name}</h3>
              <p className="text-xs text-slate-500 font-mono">
                {student.studentId} <span className="text-slate-300">•</span> UID: {student.rfidUid}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              Loading student history from MongoDB...
            </div>
          ) : (
            <>
              {/* Stat Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Total Present</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {detail?.totalAttendance ?? 0}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Duplicates</span>
                  </div>
                  <p className="text-xl font-bold text-slate-900 mt-1">
                    {detail?.totalDuplicates ?? 0}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 col-span-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Last Scan Recorded</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {lastTime} <span className="text-xs text-slate-400 font-normal">({lastDate})</span>
                    </p>
                    <span className="text-xs text-blue-600 font-medium">{timeSince}</span>
                  </div>
                </div>
              </div>

              {/* Recent Scan Attempts */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                  Recent Scan Attempts (Database Log)
                </h4>
                {detail?.recentScans && detail.recentScans.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                    {detail.recentScans.slice(0, 10).map((scan) => {
                      const scanTime = formatDateTime(scan.timestamp);
                      return (
                        <div
                          key={scan._id}
                          className="px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full font-medium text-[10px] ${
                                scan.status === 'success'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : scan.status === 'duplicate'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {scan.status.toUpperCase()}
                            </span>
                            <span className="text-slate-600">{scan.message || 'Scan processed'}</span>
                          </div>
                          <span className="text-slate-400 font-mono">
                            {scanTime.time}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-400">
                    No scan activity recorded yet for this student.
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
