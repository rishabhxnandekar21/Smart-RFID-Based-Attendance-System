import React, { useState } from 'react';
import { PlayCircle, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import api from '../services/api';

export default function SimulationControls({ onScanDispatched }) {
  const [loadingCard, setLoadingCard] = useState(null);

  const simulateCards = [
    {
      name: "Rishabh's Card",
      studentId: '23BIT054',
      uid: 'A1B2C3D4',
      bg: 'hover:bg-blue-50 hover:border-blue-300 text-blue-900',
      badge: 'bg-blue-100 text-blue-800',
    },
    {
      name: "Krish's Card",
      studentId: '23BIT282D',
      uid: 'E5F6A7B8',
      bg: 'hover:bg-purple-50 hover:border-purple-300 text-purple-900',
      badge: 'bg-purple-100 text-purple-800',
    },
    {
      name: "Pal's Card",
      studentId: '23BIT066',
      uid: 'C9D0E1F2',
      bg: 'hover:bg-indigo-50 hover:border-indigo-300 text-indigo-900',
      badge: 'bg-indigo-100 text-indigo-800',
    },
    {
      name: "Krisha's Card",
      studentId: '23BIT063',
      uid: 'B3C4D5E6',
      bg: 'hover:bg-emerald-50 hover:border-emerald-300 text-emerald-900',
      badge: 'bg-emerald-100 text-emerald-800',
    },
    {
      name: 'Unknown Card',
      studentId: 'Unregistered',
      uid: 'F987D654',
      bg: 'hover:bg-rose-50 hover:border-rose-300 text-rose-900',
      badge: 'bg-rose-100 text-rose-800',
    },
  ];

  const handleSimulate = async (card) => {
    try {
      setLoadingCard(card.uid);
      const res = await api.sendTestScan(card.uid, 'SIMULATOR_TEST');
      if (onScanDispatched) {
        onScanDispatched(res);
      }
    } catch (err) {
      // If duplicate (429) or unknown (404), the backend still returns structured JSON
      if (err.response && err.response.data) {
        if (onScanDispatched) {
          onScanDispatched(err.response.data);
        }
      } else {
        console.error('Simulation API call failed:', err);
      }
    } finally {
      setLoadingCard(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <PlayCircle className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-bold text-slate-900">Test RFID Scanning</h3>
          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            Hardware Simulation Mode
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Click any card to trigger backend verification and 10s cooldown
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {simulateCards.map((card) => {
          const isLoading = loadingCard === card.uid;
          return (
            <button
              key={card.uid}
              onClick={() => handleSimulate(card)}
              disabled={Boolean(loadingCard)}
              className={`flex flex-col items-start p-3 rounded-lg border border-slate-200 bg-white transition-all text-left shadow-2xs ${card.bg} disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-slate-900">{card.name}</span>
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${card.badge}`}>
                    {card.studentId}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                UID: <span className="font-semibold text-slate-700">{card.uid}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
