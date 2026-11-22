// Uses only the local demo accounts. IDs of created test records are saved for explicit cleanup.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire(new URL('../../ui/package.json', import.meta.url));
const { HubConnectionBuilder, LogLevel } = require('@microsoft/signalr');
const base = process.env.CMMS_API_URL ?? 'http://localhost:5231';
const password = process.env.CMMS_TEST_PASSWORD ?? 'TestPassword123!';
const output = process.env.CMMS_SMOKE_OUTPUT ?? join(tmpdir(), 'cmms-simulation-smoke.json');
let token;
const created = { machineIds: [], lineIds: [], api: base };
const connections = [];
async function request(path, method = 'GET', body, bearer = token, expected = 200) {
  const response = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const raw = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${raw.slice(0, 600)}`);
  return raw ? JSON.parse(raw) : null;
}
const login = email => request('/auth/login', 'POST', { email, password }, null);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(test, label, seconds = 20) {
  const end = Date.now() + seconds * 1000;
  do { if (await test()) return; await sleep(300); } while (Date.now() < end);
  assert.fail(`Timeout: ${label}`);
}
const remember = () => writeFile(output, JSON.stringify(created, null, 2));
async function connect(bearer) {
  const connection = new HubConnectionBuilder().withUrl(`${base}/hubs/telemetry`, { accessTokenFactory: () => bearer })
    .configureLogging(LogLevel.None).build();
  connections.push(connection); await connection.start(); return connection;
}
try {
  token = (await login('admin@smartfactory.com')).token;
  const adminHall = await login('kierownik.hala1@smartfactory.com');
  const technician = await login('technician@smartfactory.com');
  const hall = adminHall.user.factoryHallId;
  const halls = await request('/FactoryHalls');
  const other = halls.find(h => h.id !== hall).id;
  assert.equal((await request('/simulation')).redisAvailable, true);
  const line = await request('/ProductionLines', 'POST', { name: `Simulation smoke ${Date.now()}`, factoryHallId: hall });
  created.lineIds.push(line.id); await remember();
  for (let index = 0; index < 3; index++) {
    const machine = await request('/Machines', 'POST', {
      name: `Simulation smoke ${Date.now()}-${index}`, category: 'Test', serialNumber: `SMOKE-${Date.now()}-${index}`,
      factoryHallId: index < 2 ? hall : other, productionLineId: index < 2 ? line.id : null,
      status: 'Running', cycleTimeSeconds: .2, normTemp: 60, baseVib: 1, normPower: 15,
      alertThresholds: [{ metricType: 'Temperature', warningValue: 75, criticalValue: 90 }, { metricType: 'Vibration', warningValue: 3, criticalValue: 5 }]
    }, token, 201);
    assert.equal(machine.status, 'Offline'); assert.equal(machine.simulationEnabled, false);
    created.machineIds.push(machine.id); await remember();
  }
  const [first, second, outsider] = created.machineIds;
  await request(`/simulation/${first}/start`, 'POST', undefined, token, 409);
  await request(`/ProductionLines/${line.id}/start`, 'POST', undefined, token, 409);
  for (const path of [`/simulation/${outsider}/state`, `/simulation/${outsider}/profile`, `/Machines/${outsider}`, `/Machines/${outsider}/telemetry`])
    await request(path, 'GET', undefined, technician.token, 404);
  await request(`/Machines/${outsider}/start`, 'POST', undefined, adminHall.token, 404);
  await request(`/Machines/${first}/start`, 'POST', undefined, technician.token, 403);
  const scoped = await request('/simulation?hallId=' + other, 'GET', undefined, technician.token);
  assert.ok(scoped.machines.every(m => m.factoryHallId === hall));
  console.log('PASS: SQL creation, default Offline, API role and hall isolation');
  const techConnection = await connect(technician.token);
  await assert.rejects(techConnection.invoke('JoinMachine', outsider));
  await assert.rejects(techConnection.invoke('JoinHall', other));
  await techConnection.invoke('JoinMachine', first);
  const messages = [];
  techConnection.on('ReceiveTelemetry', state => messages.push(state));
  await request(`/Machines/${first}/start`, 'POST', undefined, token, 204);
  await request(`/Machines/${first}/start`, 'POST', undefined, token, 204);
  await request(`/Machines/${second}/start`, 'POST', undefined, token, 204);
  await until(() => messages.length > 1, 'SignalR telemetry');
  assert.ok(messages.every(m => m.machineId === first));
  await request(`/ProductionLines/${line.id}/start`, 'POST', undefined, token);
  await until(async () => (await request(`/simulation/${first}/state`)).state.totalProduced >= 2, 'production');
  await request(`/ProductionLines/${line.id}/halt`, 'POST', undefined, token);
  const halted = await request(`/simulation/${first}/state`);
  await sleep(1500);
  const idle = await request(`/simulation/${first}/state`);
  assert.equal(idle.state.totalProduced, halted.state.totalProduced); assert.equal(idle.workerStatus, 'Running');
  assert.ok(idle.state.tickNumber > halted.state.tickNumber);
  await request(`/simulation/${first}/stop`, 'POST', undefined, token, 204);
  const stopped = await request(`/simulation/${first}/state`);
  assert.equal(stopped.simulationEnabled, false); assert.equal(stopped.machineStatus, 'Running');
  await request(`/simulation/${first}/start`, 'POST', undefined, token, 204);
  assert.equal((await request(`/simulation/${first}/state`)).lineStatus, 'Halted');
  console.log('PASS: SignalR permissions, independent workers, production, idle telemetry, stop/resume');
  const profile = await request(`/simulation/${first}/profile`);
  await request(`/simulation/${first}/profile`, 'PUT', { ...profile, tickIntervalMs: 250, version: profile.version }, token, 204);
  const custom = await request(`/simulation/${first}/profile`);
  assert.equal(custom.preset, 'Custom'); assert.ok(custom.version > profile.version);
  await request(`/simulation/${first}/profile`, 'PUT', { ...profile, version: profile.version }, token, 409);
  await request(`/simulation/${first}/profile`, 'PUT', { ...custom, overheatingProbabilityPerHour: 2 }, token, 400);
  await request(`/simulation/${first}/preset`, 'POST', { preset: 'Chaos', version: custom.version }, token, 204);
  await request(`/ProductionLines/${line.id}/start`, 'POST', undefined, token);
  await until(async () => (await request(`/simulation/${first}/state`)).machineStatus === 'Error', 'Chaos fault', 30);
  const fault = await request(`/simulation/${first}/state`);
  assert.equal(fault.lineStatus, 'Halted'); assert.equal(fault.workerStatus, 'Running');
  const detail = await request(`/Machines/${first}`);
  assert.equal(detail.recentIncidents.filter(i => i.severity === 'Critical' && i.message.startsWith('Simulation:')).length, 1);
  assert.ok(detail.latestTelemetry.length > 0);
  await sleep(1000);
  assert.equal((await request(`/simulation/${first}/state`)).state.totalProduced, fault.state.totalProduced);
  await request(`/Machines/${first}/start`, 'POST', undefined, token, 409);
  await request(`/Machines/${first}/maintenance`, 'POST', undefined, token, 204);
  await request(`/Machines/${first}/repair`, 'POST', undefined, token, 204);
  const repaired = await request(`/simulation/${first}/state`);
  assert.equal(repaired.machineStatus, 'Offline'); assert.equal(repaired.workerStatus, 'Stopped'); assert.equal(repaired.state.faultMode, 'None');
  console.log('PASS: profile hot reload/version/validation, Chaos incident, automatic line halt, manual repair');
  await request(`/Machines/${outsider}`, 'DELETE', undefined, token, 204);
  await request(`/simulation/${outsider}/state`, 'GET', undefined, token, 404);
  console.log('ALL HTTP / SQL / REDIS / SIGNALR SMOKE CHECKS PASSED');
} finally {
  await Promise.all(connections.map(c => c.stop()));
  if (token) for (const id of created.machineIds) {
    try { await request(`/Machines/${id}/stop`, 'POST', undefined, token, 204); } catch { /* A deactivated test record is already stopped. */ }
  }
  console.log(`Created record IDs (for cleanup): ${output}`);
}
