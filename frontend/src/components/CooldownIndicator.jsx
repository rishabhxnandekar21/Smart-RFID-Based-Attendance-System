import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';

export default function CooldownIndicator({ remainingSeconds, isCooldownActive }) {
  if (isCooldownActive && remainingSeconds > 0) {
    const progressPercent = Math.max(0, Math.min(100, (remainingSeconds / 10) * 100));

    return (
      <div className="flex flex-col gap-1 w-full">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1 font-semibold text-amber-700">
            <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
            Cooldown: {remainingSeconds}s
          </span>
          <span className="text-[10px] text-amber-600 font-medium">Wait to tap</span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-amber-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200/60 w-fit">
      <CheckCircle2 className="w-3.5 h-3.5" />
      <span>Available</span>
    </div>
  );
}
