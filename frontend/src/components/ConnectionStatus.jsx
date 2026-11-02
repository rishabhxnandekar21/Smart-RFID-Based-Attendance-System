import React from 'react';
import { Cpu, Radio, Server, Clock } from 'lucide-react';

export default function ConnectionStatus({
  esp32Online,
  mqttConnected,
  backendConnected,
  currentTime,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
      {/* ESP32 Status */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all ${
          esp32Online
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
            : 'bg-slate-100 border-slate-200 text-slate-600'
        }`}
        title={esp32Online ? 'ESP32 Device is Online & Active' : 'ESP32 Device is Offline / Standby'}
      >
        <Cpu className="w-3.5 h-3.5" />
        <span className="font-medium">ESP32:</span>
        <span className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              esp32Online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
            }`}
          />
          {esp32Online ? 'Online' : 'Offline'}
        </span>
      </div>

      {/* MQTT Broker Status */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all ${
          mqttConnected
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
            : 'bg-amber-50/80 border-amber-200 text-amber-800'
        }`}
        title={mqttConnected ? 'HiveMQ Cloud Broker Connected' : 'MQTT Broker Disconnected / Simulation Mode'}
      >
        <Radio className="w-3.5 h-3.5" />
        <span className="font-medium">MQTT:</span>
        <span className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              mqttConnected ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          {mqttConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Backend Status */}
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all ${
          backendConnected
            ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
            : 'bg-rose-50/80 border-rose-200 text-rose-800'
        }`}
        title={backendConnected ? 'Backend Server & Socket.IO Active' : 'Cannot Reach Backend Server'}
      >
        <Server className="w-3.5 h-3.5" />
        <span className="font-medium">Backend:</span>
        <span className="flex items-center gap-1">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              backendConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
          {backendConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Clock */}
      <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 shadow-sm font-mono">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <span>{currentTime}</span>
      </div>
    </div>
  );
}
