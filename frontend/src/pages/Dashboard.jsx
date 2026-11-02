import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, CheckCircle2, Clock, RefreshCw, AlertCircle } from 'lucide-react';

import Header from '../components/Header';
import StatCard from '../components/StatCard';
import StudentCard from '../components/StudentCard';
import LastScanSection from '../components/LastScanSection';
import AttendanceTable from '../components/AttendanceTable';
import ScanHistory from '../components/ScanHistory';
import ScanPopup from '../components/ScanPopup';
import SimulationControls from '../components/SimulationControls';
import StudentDetailModal from '../components/StudentDetailModal';

import api from '../services/api';
import socket from '../services/socket';

export default function Dashboard() {
  // Connectivity States
  const [backendConnected, setBackendConnected] = useState(socket.connected);
  const [esp32Online, setEsp32Online] = useState(false);
  const [mqttConnected, setMqttConnected] = useState(false);

  // Core Data States
  const [students, setStudents] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [latestScan, setLatestScan] = useState(null);
  const [allScans, setAllScans] = useState([]);
  const [cooldownMap, setCooldownMap] = useState({});

  // UI Interactive States
  const [loading, setLoading] = useState(true);
  const [activePopupEvent, setActivePopupEvent] = useState(null);
  const [selectedStudentForDetail, setSelectedStudentForDetail] = useState(null);
  const [historyFilterStatus, setHistoryFilterStatus] = useState('all');
  const [historyFilterUid, setHistoryFilterUid] = useState('');

  // 1. Initial Data Fetch
  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);

      const [healthRes, devRes, stuRes, attRes, scanRes, cdRes] = await Promise.allSettled([
        api.getHealth(),
        api.getDevicesStatus(),
        api.getStudents(),
        api.getTodayAttendance(),
        api.getScans({ limit: 50 }),
        api.getCooldowns(),
      ]);

      if (healthRes.status === 'fulfilled') {
        setBackendConnected(true);
        setMqttConnected(Boolean(healthRes.value?.mqtt?.isConnected));
      }

      if (devRes.status === 'fulfilled' && devRes.value.success) {
        const esp = devRes.value.data?.find((d) => d.deviceId.includes('ESP32'));
        if (esp) setEsp32Online(esp.isOnline);
      }

      if (stuRes.status === 'fulfilled' && stuRes.value.success) {
        setStudents(stuRes.value.data || []);
      }

      if (attRes.status === 'fulfilled' && attRes.value.success) {
        setTodayAttendance(attRes.value.data || []);
      }

      if (scanRes.status === 'fulfilled' && scanRes.value.success) {
        const scanList = scanRes.value.data || [];
        setAllScans(scanList);
        if (scanList.length > 0) {
          setLatestScan(scanList[0]);
        }
      }

      if (cdRes.status === 'fulfilled' && cdRes.value.success) {
        const cdDict = {};
        (cdRes.value.data || []).forEach((c) => {
          cdDict[c.rfidUid] = {
            isCooldownActive: c.isCooldownActive,
            remainingSeconds: c.remainingSeconds,
          };
        });
        setCooldownMap(cdDict);
      }
    } catch (err) {
      console.error('Error loading initial dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // 2. Setup Socket.IO Listeners
  useEffect(() => {
    const handleConnect = () => {
      setBackendConnected(true);
      // Refresh health & device status on connect
      api.getHealth().then((h) => setMqttConnected(Boolean(h?.mqtt?.isConnected))).catch(() => {});
      api.getDevicesStatus().then((d) => {
        const esp = d.data?.find((item) => item.deviceId.includes('ESP32'));
        if (esp) setEsp32Online(esp.isOnline);
      }).catch(() => {});
    };

    const handleDisconnect = () => {
      setBackendConnected(false);
      setEsp32Online(false);
    };

    const handleDeviceStatus = (data) => {
      if (data && data.deviceId && data.deviceId.includes('ESP32')) {
        setEsp32Online(Boolean(data.isOnline));
      }
    };

    const handleMqttStatus = (data) => {
      setMqttConnected(Boolean(data.isConnected));
    };

    const handleAttendanceUpdate = (record) => {
      setTodayAttendance((prev) => [record, ...prev.slice(0, 19)]);

      // Update student's last attendance in students list
      setStudents((prev) =>
        prev.map((s) =>
          s.studentId === record.studentId
            ? { ...s, lastAttendanceTimestamp: record.timestamp, totalAttendance: (s.totalAttendance || 0) + 1 }
            : s
        )
      );
    };

    const handleScanEvent = (event) => {
      setLatestScan(event);
      setAllScans((prev) => [event, ...prev.slice(0, 49)]);

      // Show the mandatory result popup only on confirmed backend event
      setActivePopupEvent(event);
    };

    const handleCooldownUpdate = (cdData) => {
      setCooldownMap((prev) => ({
        ...prev,
        [cdData.rfidUid]: {
          isCooldownActive: Boolean(cdData.active),
          remainingSeconds: cdData.remainingSeconds || 10,
        },
      }));
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('device-status', handleDeviceStatus);
    socket.on('mqtt-status', handleMqttStatus);
    socket.on('attendance-update', handleAttendanceUpdate);
    socket.on('scan-event', handleScanEvent);
    socket.on('cooldown-update', handleCooldownUpdate);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('device-status', handleDeviceStatus);
      socket.off('mqtt-status', handleMqttStatus);
      socket.off('attendance-update', handleAttendanceUpdate);
      socket.off('scan-event', handleScanEvent);
      socket.off('cooldown-update', handleCooldownUpdate);
    };
  }, []);

  // 3. Client-side second-by-second countdown ticker for active cooldowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldownMap((prev) => {
        let changed = false;
        const updated = { ...prev };

        Object.keys(updated).forEach((uid) => {
          const item = updated[uid];
          if (item && item.isCooldownActive && item.remainingSeconds > 0) {
            const nextSec = item.remainingSeconds - 1;
            updated[uid] = {
              remainingSeconds: nextSec,
              isCooldownActive: nextSec > 0,
            };
            changed = true;
          }
        });

        return changed ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Summary Metrics calculations
  const totalRegisteredCards = students.length;
  const successfulAttendanceToday = todayAttendance.length;

  const lastSuccessfulScanTime = useMemo(() => {
    if (todayAttendance.length > 0) {
      const ts = todayAttendance[0].timestamp;
      return new Date(ts).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    }
    return 'None yet';
  }, [todayAttendance]);

  // Filtered Scan History
  const filteredScans = useMemo(() => {
    return allScans.filter((scan) => {
      const matchStatus =
        historyFilterStatus === 'all' || scan.status === historyFilterStatus;
      const matchUid =
        !historyFilterUid || (scan.uid && scan.uid.toUpperCase() === historyFilterUid.toUpperCase());
      return matchStatus && matchUid;
    });
  }, [allScans, historyFilterStatus, historyFilterUid]);

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900 pb-12">
      {/* Top Navigation Bar */}
      <Header
        esp32Online={esp32Online}
        mqttConnected={mqttConnected}
        backendConnected={backendConnected}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full space-y-6">
        {/* A. Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Registered RFID Cards"
            value={totalRegisteredCards < 10 ? `0${totalRegisteredCards}` : totalRegisteredCards}
            subtitle="Verified student cards in database"
            icon={Users}
            color="blue"
          />
          <StatCard
            title="Successful Attendance Today"
            value={
              successfulAttendanceToday < 10
                ? `0${successfulAttendanceToday}`
                : successfulAttendanceToday
            }
            subtitle="Live confirmed scans"
            icon={CheckCircle2}
            color="emerald"
          />
          <StatCard
            title="Last Successful Scan"
            value={lastSuccessfulScanTime}
            subtitle={todayAttendance[0]?.studentName || 'Awaiting scans'}
            icon={Clock}
            color="indigo"
          />
        </div>

        {/* Hardware Simulation Controls */}
        <SimulationControls
          onScanDispatched={(result) => {
            // State updates and popups are handled centrally by Socket.IO event handler
          }}
        />

        {/* C. Last RFID Scan Section */}
        <LastScanSection scan={latestScan} />

        {/* B. Registered RFID Cards Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Registered Student RFID Cards</h2>
              <p className="text-xs text-slate-500">
                Click any student card to view detailed scan analytics & history
              </p>
            </div>
            <button
              onClick={loadInitialData}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors px-2 py-1 rounded bg-white border border-slate-200"
              title="Refresh from MongoDB"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Sync</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {students.map((student) => (
              <StudentCard
                key={student.studentId}
                student={student}
                cooldown={cooldownMap[student.rfidUid]}
                onSelectStudent={(stu) => setSelectedStudentForDetail(stu)}
              />
            ))}
          </div>
        </div>

        {/* D. Today's Attendance Table */}
        <AttendanceTable entries={todayAttendance} loading={loading} />

        {/* E. RFID Scan History (All Attempts) */}
        <ScanHistory
          scans={filteredScans}
          filterStatus={historyFilterStatus}
          onFilterChange={(st) => setHistoryFilterStatus(st)}
          selectedUid={historyFilterUid}
          onUidFilterChange={(u) => setHistoryFilterUid(u)}
          registeredStudents={students}
        />
      </main>

      {/* Popups & Modals */}
      <ScanPopup
        event={activePopupEvent}
        onClose={() => setActivePopupEvent(null)}
      />

      {selectedStudentForDetail && (
        <StudentDetailModal
          student={selectedStudentForDetail}
          onClose={() => setSelectedStudentForDetail(null)}
        />
      )}
    </div>
  );
}
