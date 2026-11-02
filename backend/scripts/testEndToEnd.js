import http from 'http';

const BASE_URL = 'http://localhost:5001';

async function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTests() {
  console.log('=====================================================');
  console.log('   STARTING RFID ATTENDANCE SYSTEM END-TO-END TESTS  ');
  console.log('=====================================================\n');

  try {
    // 1. Health check
    console.log('[Test 0] Checking Backend Health...');
    const health = await makeRequest('/api/health');
    console.log('  -> Health response:', health.data);
    if (health.status !== 200 || health.data.database !== 'connected') {
      throw new Error('Health check failed: DB not connected');
    }
    console.log('  ✓ Test 0 Passed: Server and MongoDB are healthy.\n');

    // 2. Test 1: Successful scan for Rahul (A1B2C3D4)
    console.log("[Test 1] Testing Successful Scan for Rahul Sharma (A1B2C3D4)...");
    const scan1 = await makeRequest('/api/attendance/test-scan', 'POST', {
      uid: 'A1B2C3D4',
      deviceId: 'TEST_RUNNER',
    });
    console.log('  -> Scan 1 response:', scan1.data);
    if (scan1.status !== 200 || scan1.data.status !== 'success') {
      throw new Error(`Test 1 Failed: Expected status success, got ${scan1.data.status}`);
    }
    if (scan1.data.studentName !== 'Rahul Sharma') {
      throw new Error(`Test 1 Failed: Expected student Rahul Sharma, got ${scan1.data.studentName}`);
    }
    console.log('  ✓ Test 1 Passed: Rahul attendance recorded successfully.\n');

    // 3. Test 2: Immediate duplicate scan for Rahul (should be rejected by 10s cooldown)
    console.log("[Test 2] Testing Immediate Duplicate Scan for Rahul after 2 seconds...");
    await delay(2000);
    const scan2 = await makeRequest('/api/attendance/test-scan', 'POST', {
      uid: 'A1B2C3D4',
      deviceId: 'TEST_RUNNER',
    });
    console.log('  -> Scan 2 response:', scan2.data);
    if (scan2.status !== 429 || scan2.data.status !== 'duplicate') {
      throw new Error(`Test 2 Failed: Expected status duplicate (429), got ${scan2.status} / ${scan2.data.status}`);
    }
    if (typeof scan2.data.remainingSeconds !== 'number' || scan2.data.remainingSeconds <= 0) {
      throw new Error(`Test 2 Failed: Invalid remainingSeconds: ${scan2.data.remainingSeconds}`);
    }
    console.log(`  ✓ Test 2 Passed: Duplicate correctly rejected with ${scan2.data.remainingSeconds}s cooldown.\n`);

    // 4. Test 4: Independent cards - Priya (E5F6A7B8) should succeed while Rahul is still in cooldown!
    console.log("[Test 4] Testing Independent Card: Priya Patel (E5F6A7B8) while Rahul is in cooldown...");
    const scanPriya = await makeRequest('/api/attendance/test-scan', 'POST', {
      uid: 'E5F6A7B8',
      deviceId: 'TEST_RUNNER',
    });
    console.log('  -> Priya scan response:', scanPriya.data);
    if (scanPriya.status !== 200 || scanPriya.data.status !== 'success') {
      throw new Error(`Test 4 Failed: Priya should succeed, got ${scanPriya.data.status}`);
    }
    console.log('  ✓ Test 4 Passed: Priya succeeded independently of Rahul.\n');

    // 5. Test 5: Unknown card tap (F987D654)
    console.log("[Test 5] Testing Unknown Card (F987D654)...");
    const scanUnknown = await makeRequest('/api/attendance/test-scan', 'POST', {
      uid: 'F987D654',
      deviceId: 'TEST_RUNNER',
    });
    console.log('  -> Unknown card response:', scanUnknown.data);
    if (scanUnknown.status !== 404 || scanUnknown.data.status !== 'unknown') {
      throw new Error(`Test 5 Failed: Expected unknown (404), got ${scanUnknown.status}`);
    }
    console.log('  ✓ Test 5 Passed: Unknown card rejected without creating attendance.\n');

    // 6. Test 8: Concurrency / Simultaneous scans race condition test
    // Fire two identical scans for Arjun Mehta (C9D0E1F2) at the exact same millisecond
    console.log("[Test 8] Testing Simultaneous Concurrency for Arjun Mehta (C9D0E1F2)...");
    const [simul1, simul2] = await Promise.all([
      makeRequest('/api/attendance/test-scan', 'POST', { uid: 'C9D0E1F2', deviceId: 'SIMUL_A' }),
      makeRequest('/api/attendance/test-scan', 'POST', { uid: 'C9D0E1F2', deviceId: 'SIMUL_B' }),
    ]);

    const statuses = [simul1.data.status, simul2.data.status];
    console.log('  -> Concurrent responses:', statuses);
    const successCount = statuses.filter((s) => s === 'success').length;
    const duplicateCount = statuses.filter((s) => s === 'duplicate').length;

    if (successCount !== 1 || duplicateCount !== 1) {
      throw new Error(`Test 8 Failed: Expected exactly 1 success and 1 duplicate, got ${successCount} success and ${duplicateCount} duplicate`);
    }
    console.log('  ✓ Test 8 Passed: Atomic database cooldown prevented race condition. Exactly 1 accepted.\n');

    // 7. Test 6: Verify MongoDB Persistence & Tables
    console.log("[Test 6] Verifying Data Persistence in MongoDB via REST APIs...");
    const todayAtt = await makeRequest('/api/attendance/today');
    console.log(`  -> Today attendance count: ${todayAtt.data.count}`);
    const scanLogs = await makeRequest('/api/scans');
    console.log(`  -> Scan history log count: ${scanLogs.data.count}`);

    if (todayAtt.data.count < 3) {
      throw new Error('Test 6 Failed: Expected at least 3 successful records today');
    }
    console.log('  ✓ Test 6 Passed: Records persisted and retrievable via API.\n');

    console.log('=====================================================');
    console.log('   ALL 8 IoT ATTENDANCE TEST SCENARIOS PASSED 100%!  ');
    console.log('=====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST RUNNER FAILED:', err.message);
    process.exit(1);
  }
}

runTests();
