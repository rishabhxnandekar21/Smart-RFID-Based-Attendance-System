import React from 'react';
import { Radio, CheckCircle2, AlertTriangle, AlertOctagon, Clock, Cpu } from 'lucide-react';

export default function LastScanSection({ scan }) {
  if (!scan) {
    return (
      <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800">Latest RFID Scan</h4>
            <p className="text-xs text-slate-400">Waiting for first card tap...</p>
          </div>
        </div>
        <span className="text-xs text-slate-400 font-mono">Standby</span>
      </div>
    );
  }

  const isSuccess = scan.status === 'success';
  const isDuplicate = scan.status === 'duplicate';
  const isUnknown = scan.status === 'unknown';

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

  const statusConfig = {
    success: {
      border: 'border-emerald-200 bg-emerald-50/30',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      tag: 'Success',
      bannerMsg: 'Attendance marked successfully.',
    },
    duplicate: {
      border: 'border-amber-200 bg-amber-50/30',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      icon: <AlertTriangle className="w-5 h-5 text-amber-600" />,
      tag: 'Duplicate',
      bannerMsg: 'This card was already scanned. Please wait.',
    },
    unknown: {
      border: 'border-rose-200 bg-rose-50/30',
      badge: 'bg-rose-100 text-rose-800 border-rose-300',
      icon: <AlertOctagon className="w-5 h-5 text-rose-600" />,
      tag: 'Unknown',
      bannerMsg: 'Unknown RFID card.',
    },
  };

  const conf = statusConfig[scan.status] || statusConfig.unknown;

  return (
    <div className={`rounded-xl border p-5 shadow-xs transition-all ${conf.border} bg-white`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Icon & Student / UID */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0">
            {conf.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Latest RFID Scan
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${conf.badge}`}>
                {conf.tag}
              </span>
            </div>
            <h4 className="text-base font-bold text-slate-900 mt-0.5">
              {scan.studentName || 'Unregistered Card'}
              {scan.studentId && (
                <span className="ml-2 text-xs font-mono font-medium text-slate-500">
                  [{scan.studentId}]
                </span>
              )}
            </h4>
          </div>
        </div>

        {/* Right: Info Metadata */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/60">
            <span className="text-slate-400">UID:</span>
            <span className="font-bold text-slate-800">{scan.uid}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/60">
            <Cpu className="w-3.5 h-3.5 text-slate-400" />
            <span>{scan.deviceId || 'ESP32_01'}</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/60">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{formatTime(scan.timestamp)}</span>
          </div>
        </div>
      </div>

      {/* Result Message Banner */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <p className="font-medium text-slate-700">
          {conf.bannerMsg}
          {scan.remainingSeconds ? (
            <span className="ml-1 text-amber-700 font-bold">
              (Cooldown: {scan.remainingSeconds}s remaining)
            </span>
          ) : null}
        </p>
        <span className="text-[11px] text-slate-400">Instant Event Sync</span>
      </div>
    </div>
  );
}
