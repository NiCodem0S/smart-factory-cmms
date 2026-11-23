import test from 'node:test'
import assert from 'node:assert/strict'
import { withLiveReadings } from '../../ui/src/utils/dashboardTelemetry.ts'

const now = Date.parse('2026-11-22T12:00:00Z')
const timestamp = offset => new Date(now + offset).toISOString()
const reading = (offset, powerLoadKw, networkLatencyMs = null) => ({
    timestampUtc: timestamp(offset), temperature: 55, vibration: 1, powerLoadKw, networkLatencyMs,
})
const machine = (id, status, totalProduced, latestTelemetry) => ({ id, status, totalProduced, latestTelemetry })
const snapshot = machines => ({
    generatedAtUtc: timestamp(0), factoryHallId: 'hall', hallIds: ['hall'], machines,
    incidents: [{ id: 'critical-incident' }], summary: { totalMachines: machines.length, activeCriticalIncidents: 1 },
})
const live = (machineId, offset, machineStatus, totalProduced, powerLoadKw) => ({
    at: now + offset,
    state: { machineId, lastTickAtUtc: timestamp(offset), machineStatus, totalProduced, powerLoadKw, temperature: 65, vibration: 2.5 },
})

test('dashboard merges live telemetry for visible machines and recomputes scoped totals from fresh readings', () => {
    const data = snapshot([
        machine('lathe', 'Running', 8, reading(-2_000, 12, 10)),
        machine('drill', 'Warning', 5, reading(-59_000, 5, 20)),
        machine('press', 'Offline', 3, reading(-62_000, 90, 500)),
    ])
    const merged = withLiveReadings(data, new Map([
        ['lathe', live('lathe', 1_000, 'Error', 9, 0)],
        ['other-hall', live('other-hall', 30_000, 'Error', 999, 99)],
    ]))

    assert.equal(merged.machines.length, 3)
    assert.equal(merged.machines[0].status, 'Error')
    assert.equal(merged.machines[0].latestTelemetry.temperature, 65)
    assert.equal(merged.machines[0].latestTelemetry.networkLatencyMs, null)
    assert.equal(merged.incidents, data.incidents)
    assert.deepEqual(merged.summary, {
        totalMachines: 3, activeCriticalIncidents: 1,
        runningMachines: 0, warningMachines: 1, errorMachines: 1, maintenanceMachines: 0, offlineMachines: 1,
        totalProduced: 17, powerLoadKw: 5, averageLatencyMs: 20, machinesWithPowerReadings: 2,
    })
})

test('a buffered live reading preserves fresh metrics while a newer HTTP snapshot owns the status', () => {
    const data = snapshot([machine('press', 'Maintenance', 23, reading(-4_000, 8))])
    const buffered = live('press', -1_000, 'Running', 22, 0)
    const merged = withLiveReadings(data, new Map([['press', buffered]]))

    assert.equal(merged.machines[0].status, 'Maintenance')
    assert.equal(merged.machines[0].latestTelemetry.timestampUtc, buffered.state.lastTickAtUtc)
    assert.equal(merged.summary.totalProduced, 23)
    assert.equal(merged.summary.powerLoadKw, 0)
    assert.equal(merged.summary.averageLatencyMs, null)
    assert.equal(merged.summary.machinesWithPowerReadings, 1)
    assert.equal(withLiveReadings(merged, new Map([['press', live('press', -5_000, 'Warning', 21, 1)]])), merged)
})
