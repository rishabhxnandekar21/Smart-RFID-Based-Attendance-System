import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  getHealth: async () => {
    const res = await apiClient.get('/health');
    return res.data;
  },

  getDevicesStatus: async () => {
    const res = await apiClient.get('/devices/status');
    return res.data;
  },

  getStudents: async () => {
    const res = await apiClient.get('/students');
    return res.data;
  },

  getStudentDetail: async (studentId) => {
    const res = await apiClient.get(`/students/${studentId}`);
    return res.data;
  },

  getTodayAttendance: async () => {
    const res = await apiClient.get('/attendance/today');
    return res.data;
  },

  getLatestScan: async () => {
    const res = await apiClient.get('/attendance/latest');
    return res.data;
  },

  getScans: async (params = {}) => {
    const res = await apiClient.get('/scans', { params });
    return res.data;
  },

  getCooldowns: async () => {
    const res = await apiClient.get('/cooldown');
    return res.data;
  },

  sendTestScan: async (uid, deviceId = 'SIMULATOR_01') => {
    const res = await apiClient.post('/attendance/test-scan', { uid, deviceId });
    return res.data;
  },
};

export default api;
