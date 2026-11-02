import mqtt from 'mqtt';
import { processRfidScan, updateDeviceActivity } from './attendanceService.js';

let client = null;
let isConnected = false;
let socketIoInstance = null;

export function getMqttStatus() {
  return {
    isConnected,
    brokerUrl: process.env.MQTT_BROKER_URL || 'Not configured',
    clientId: process.env.MQTT_CLIENT_ID || 'rfid-backend-server',
  };
}

export function publishMqttMessage(topic, payload) {
  if (!client || !isConnected) {
    console.log(`[MQTT] Cannot publish to ${topic} (client not connected)`);
    return false;
  }

  try {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    client.publish(topic, payloadStr, { qos: 1 }, (err) => {
      if (err) {
        console.error(`[MQTT] Publish error to ${topic}:`, err.message);
      } else {
        console.log(`[MQTT] Published to ${topic}:`, payloadStr);
      }
    });
    return true;
  } catch (err) {
    console.error(`[MQTT] Failed to publish message:`, err.message);
    return false;
  }
}

export function initMqttClient(socketIo) {
  socketIoInstance = socketIo;
  const brokerUrl = process.env.MQTT_BROKER_URL;
  const username = process.env.MQTT_USERNAME;
  const password = process.env.MQTT_PASSWORD;
  const clientId =
    process.env.MQTT_CLIENT_ID || `rfid-backend-${Math.random().toString(16).substring(2, 8)}`;
  const scanTopic = process.env.MQTT_SCAN_TOPIC || 'attendance/+/scan';
  const statusTopic = 'attendance/+/status';

  if (!brokerUrl) {
    console.log('[MQTT] MQTT_BROKER_URL not configured. Running in standalone/simulation mode.');
    return null;
  }

  console.log(`[MQTT] Connecting to broker: ${brokerUrl}...`);

  const options = {
    clientId,
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 5000,
    keepalive: 60,
  };

  if (username) options.username = username;
  if (password) options.password = password;

  try {
    client = mqtt.connect(brokerUrl, options);

    client.on('connect', () => {
      isConnected = true;
      console.log(`[MQTT] Connected successfully to ${brokerUrl} as ${clientId}`);

      // Subscribe to scan events and device status heartbeats with QoS 1
      client.subscribe([scanTopic, statusTopic], { qos: 1 }, (err, granted) => {
        if (err) {
          console.error('[MQTT] Subscription error:', err.message);
        } else {
          console.log('[MQTT] Subscriptions granted:', granted.map((g) => g.topic).join(', '));
        }
      });

      if (socketIoInstance) {
        socketIoInstance.emit('mqtt-status', { isConnected: true, brokerUrl });
      }
    });

    client.on('message', async (topic, messageBuffer) => {
      const topicStr = topic.toString();
      const messageStr = messageBuffer.toString();
      console.log(`[MQTT Message] Topic: ${topicStr} | Payload: ${messageStr}`);

      let payload = null;
      try {
        payload = JSON.parse(messageStr);
      } catch (e) {
        console.error(`[MQTT] Failed to parse message JSON on ${topicStr}:`, e.message);
        return;
      }

      // Check if this is a device heartbeat / status message
      // Topic format: attendance/{deviceId}/status
      if (topicStr.endsWith('/status')) {
        const parts = topicStr.split('/');
        const deviceId = payload.deviceId || parts[1] || 'ESP32_01';
        await updateDeviceActivity(deviceId, socketIoInstance);
        return;
      }

      // Check if this is a scan event: attendance/{deviceId}/scan
      if (topicStr.includes('/scan')) {
        const parts = topicStr.split('/');
        const topicDeviceId = parts[1] || 'ESP32_01';
        const deviceId = payload.deviceId || topicDeviceId;
        const uid = payload.uid;
        const eventId = payload.eventId;

        if (!uid) {
          console.warn('[MQTT] Scan message missing UID:', payload);
          return;
        }

        await processRfidScan({
          uid,
          deviceId,
          eventId,
          socketIo: socketIoInstance,
          mqttPublish: publishMqttMessage,
        });
      }
    });

    client.on('error', (err) => {
      console.error('[MQTT] Client error:', err.message);
    });

    client.on('offline', () => {
      if (isConnected) {
        console.log('[MQTT] Broker connection went offline');
        isConnected = false;
        if (socketIoInstance) {
          socketIoInstance.emit('mqtt-status', { isConnected: false, brokerUrl });
        }
      }
    });

    client.on('reconnect', () => {
      console.log('[MQTT] Attempting to reconnect...');
    });

    client.on('close', () => {
      isConnected = false;
    });

    return client;
  } catch (err) {
    console.error('[MQTT] Connection initialization exception:', err.message);
    return null;
  }
}
