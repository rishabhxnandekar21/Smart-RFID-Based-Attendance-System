import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, X, Clock, ShieldAlert } from 'lucide-react';

export default function ScanPopup({ event, onClose }) {
  const [visible, setVisible] = useState(false);
  const [remainingCountdown, setRemainingCountdown] = useState(0);

  useEffect(() => {
    if (!event) {
      setVisible(false);
      return;
    }

    setVisible(true);

    if (event.status === 'duplicate' && event.remainingSeconds) {
      setRemainingCountdown(event.remainingSeconds);
    }

    // Auto-dismiss after 3.2 seconds
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, 3200);

    return () => clearTimeout(timer);
  }, [event, onClose]);

  // Handle countdown tick for duplicate popup
  useEffect(() => {
    if (remainingCountdown <= 0) return;
    const interval = setInterval(() => {
      setRemainingCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingCountdown]);

  if (!visible || !event) return null;

  const isSuccess = event.status === 'success';
  const isDuplicate = event.status === 'duplicate';
  const isUnknown = event.status === 'unknown';

  const formatTime = (ts) => {
    const d = ts ? new Date(ts) : new Date();
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  return (
    <>
      {/* Toast Notification (Top Right) */}
      <div className="fixed top-5 right-5 z-50 animate-pop-in pointer-events-auto">
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm bg-white ${
            isSuccess
              ? 'border-emerald-300 text-emerald-950'
              : isDuplicate
              ? 'border-amber-300 text-amber-950'
              : 'border-rose-300 text-rose-950'
          }`}
        >
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isSuccess
                ? 'bg-emerald-100 text-emerald-700'
                : isDuplicate
                ? 'bg-amber-100 text-amber-700'
                : 'bg-rose-100 text-rose-700'
            }`}
          >
            {isSuccess && <CheckCircle2 className="w-4 h-4" />}
            {isDuplicate && <AlertTriangle className="w-4 h-4" />}
            {isUnknown && <AlertOctagon className="w-4 h-4" />}
          </div>
          <div className="pr-2">
            <p className="font-semibold text-xs">
              {isSuccess && 'Attendance Recorded'}
              {isDuplicate && 'Duplicate Tap Rejected'}
              {isUnknown && 'Unregistered Card'}
            </p>
            <p className="text-[11px] text-slate-500 font-mono">
              {event.studentName || event.uid}
            </p>
          </div>
        </div>
      </div>

      {/* Centered Modal Popup */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs">
        <div
          className={`relative bg-white rounded-2xl border shadow-2xl max-w-md w-full p-6 text-center animate-pop-in overflow-hidden ${
            isSuccess
              ? 'border-emerald-200 ring-4 ring-emerald-50'
              : isDuplicate
              ? 'border-amber-200 ring-4 ring-amber-50'
              : 'border-rose-200 ring-4 ring-rose-50'
          }`}
        >
          {/* Close button */}
          <button
            onClick={() => {
              setVisible(false);
              if (onClose) onClose();
            }}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* SUCCESS MODAL */}
          {isSuccess && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 ring-8 ring-emerald-50 animate-bounce">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 tracking-wider uppercase bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 mb-2">
                Confirmed in Database
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                ATTENDANCE MARKED SUCCESSFULLY!
              </h3>

              <div className="mt-5 w-full bg-slate-50 rounded-xl p-4 border border-slate-100 text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Student:</span>
                  <span className="font-semibold text-slate-900">{event.studentName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Student ID:</span>
                  <span className="font-mono text-slate-700">{event.studentId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">RFID UID:</span>
                  <span className="font-mono font-medium text-slate-800">{event.uid}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Time:</span>
                  <span className="font-mono text-slate-700">{formatTime(event.timestamp)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Device:</span>
                  <span className="font-mono text-slate-700">{event.deviceId || 'ESP32_01'}</span>
                </div>
              </div>

              {/* Progress timer indicator */}
              <div className="w-full mt-4 bg-slate-100 h-1 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 animate-[pulse_1s_infinite] w-full" />
              </div>
            </div>
          )}

          {/* DUPLICATE MODAL */}
          {isDuplicate && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-4 ring-8 ring-amber-50">
                <AlertTriangle className="w-9 h-9" />
              </div>
              <span className="text-[11px] font-bold text-amber-700 tracking-wider uppercase bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200 mb-2">
                10-Second Cooldown Active
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                DUPLICATE SCAN!
              </h3>
              <p className="text-sm font-semibold text-slate-700 mt-1">
                {event.studentName}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Please wait before scanning this card again.
              </p>

              <div className="mt-5 w-full bg-amber-50/70 rounded-xl p-4 border border-amber-200/80 flex items-center justify-center gap-2">
                <Clock className="w-5 h-5 text-amber-700 animate-spin" style={{ animationDuration: '4s' }} />
                <span className="text-base font-bold text-amber-900">
                  Remaining time: {remainingCountdown || event.remainingSeconds || 1} seconds
                </span>
              </div>
            </div>
          )}

          {/* UNKNOWN CARD MODAL */}
          {isUnknown && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4 ring-8 ring-rose-50">
                <ShieldAlert className="w-9 h-9" />
              </div>
              <span className="text-[11px] font-bold text-rose-700 tracking-wider uppercase bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200 mb-2">
                Access Denied
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-slate-900">
                UNKNOWN RFID CARD!
              </h3>
              <p className="text-xs text-slate-600 mt-2">
                This RFID card is not registered in the system.
              </p>
              <div className="mt-4 px-3 py-1.5 bg-slate-100 rounded-md font-mono text-xs text-slate-700">
                Scanned UID: <span className="font-bold text-rose-600">{event.uid}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-3">
                No attendance was recorded.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
