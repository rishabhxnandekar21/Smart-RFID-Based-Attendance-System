import React, { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';
import ConnectionStatus from './ConnectionStatus';

export default function Header({ esp32Online, mqttConnected, backendConnected }) {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* Branding */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                RFID Attendance Monitor
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                IoT Live
              </span>
            </div>
            <p className="text-xs text-slate-500 font-normal">
              Smart IoT Attendance System <span className="text-slate-300">|</span> ESP32 + RC522
            </p>
          </div>
        </div>

        {/* Live Connectivity Indicators & Clock */}
        <ConnectionStatus
          esp32Online={esp32Online}
          mqttConnected={mqttConnected}
          backendConnected={backendConnected}
          currentTime={timeStr}
        />
      </div>
    </header>
  );
}
