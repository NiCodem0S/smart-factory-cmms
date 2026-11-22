import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeLive, mergeSnapshot, telemetryPoint, telemetryTimestamp, mergeTelemetry, breakTelemetryGaps, isolatedTelemetryPoint } from '../../ui/src/utils/telemetrySeries.ts'
import { dailyTickLabel, historyClockTicks, historyRangeLabel, metricScale, recordedIntervals, recordedViewport } from '../../ui/src/utils/telemetryHistoryView.ts'

const now = Date.parse('2026-10-28T14:20:00Z')
const point = (offset, temperature = 60, vibration = 1) => ({ time: now + offset, temperature, vibration })

test('old timestamps without a zone are interpreted as UTC', () => {
  assert.equal(telemetryTimestamp('2026-10-28T14:20:00'), now)
  assert.equal(telemetryTimestamp('2026-10-28T15:20:00+01:00'), now)
})
test('Live excludes old seeded history and future samples', () => {
  assert.deepEqual(mergeTelemetry([point(-86400000), point(-61000), point(-20000), point(1)], [point(0)], now - 60000, now), [point(-20000), point(0)])
})
test('history and stream readings are sorted, deduplicated, and live values win', () => {
  assert.deepEqual(mergeTelemetry([point(-1000, 40), point(-2000, 42), point(-1000, 41)], [point(-1000, 65, 2)], now - 60000, now),
    [point(-2000, 42), point(-1000, 65, 2)])
})
test('temperature or vibration is usable without power and without the other metric', () => {
  assert.deepEqual(telemetryPoint('2026-10-28T14:20:00Z', 72, null), point(0, 72, null))
  assert.deepEqual(telemetryPoint('2026-10-28T14:20:00Z', null, 2.5), point(0, null, 2.5))
})
test('missing or invalid data never becomes a fabricated zero', () => {
  assert.equal(telemetryPoint('2026-10-28T14:20:00Z', null, undefined), null)
  assert.equal(telemetryPoint('invalid', 60, 1), null)
  assert.equal(telemetryPoint('2026-10-28T14:20:00Z', NaN, Infinity), null)
  assert.deepEqual(telemetryPoint('2026-10-28T14:20:00Z', 0, 0), point(0, 0, 0))
})
test('long outages break both curves instead of drawing a diagonal through missing readings', () => {
  const series = breakTelemetryGaps([point(-50000), point(-45000), point(-5000)], 15000)
  assert.deepEqual(series, [point(-50000), point(-45000), point(-25000, null, null), point(-5000)])
})
test('normal sample spacing stays connected and missing metrics stay null', () => {
  const original = [point(-10000, 70, null), point(-5000, 71, 1.2), point(0, null, 1.3)]
  assert.deepEqual(breakTelemetryGaps(original, 15000), original)
})
test('empty and single-point series do not invent history', () => {
  assert.deepEqual(breakTelemetryGaps([], 15000), [])
  assert.deepEqual(mergeTelemetry([], [point(0)], now - 60000, now), [point(0)])
})
test('an hour view retains samples before the most recent minute', () => {
  assert.deepEqual(mergeTelemetry([point(-1800000), point(-7200000)], [point(-1000)], now - 3600000, now), [point(-1800000), point(-1000)])
})

test('isolated readings stay visible as dots even when both adjoining lines are broken', () => {
  const series = breakTelemetryGaps([point(-50000), point(-10000, null, 2)], 15000)
  assert.equal(isolatedTelemetryPoint(series, 0, 'temperature'), true)
  assert.equal(isolatedTelemetryPoint(series, 2, 'vibration'), true)
  assert.equal(isolatedTelemetryPoint(series, 2, 'temperature'), false)
  assert.equal(isolatedTelemetryPoint([point(-1000), point(0)], 0, 'temperature'), false)
})

const minute = 60_000
const hourStart = now - 60 * minute

test('the recorded viewport keeps the full hour for absent or widely spaced samples', () => {
  assert.deepEqual(recordedViewport([], hourStart, now), { start: hourStart, end: now })
  const samples = [point(-59 * minute), point(-27 * minute), point(-minute)]
  assert.deepEqual(recordedViewport(samples, hourStart, now), { start: hourStart, end: now })
})

test('the recorded viewport fits around the timestamps of sparse readings', () => {
  const samples = [point(-38 * minute), point(-30 * minute)]
  const view = recordedViewport(samples, hourStart, now)
  assert.ok(hourStart <= view.start && view.start < samples[0].time)
  assert.ok(samples[1].time < view.end && view.end <= now)
  assert.ok(view.end - view.start < 60 * minute)
})

test('one reading gets a visible range without extending beyond either end of the hour', () => {
  assert.deepEqual(recordedViewport([point(-60 * minute)], hourStart, now), {
    start: hourStart, end: hourStart + 5 * minute,
  })
  assert.deepEqual(recordedViewport([point(0)], hourStart, now), {
    start: now - 5 * minute, end: now,
  })
})

test('a metric scale includes extreme readings and ignores missing values', () => {
  const samples = [point(-5000, -35, 0.2), point(-2500, null, null), point(0, 180, 9)]
  assert.deepEqual(metricScale(samples, 'temperature'), metricScale([samples[0], samples[2]], 'temperature'))
  const temperature = metricScale(samples, 'temperature')
  const vibration = metricScale(samples, 'vibration')
  assert.ok(temperature.min <= -35 && temperature.max >= 180 && temperature.step > 0)
  assert.ok(vibration.min >= 0 && vibration.min <= 0.2 && vibration.max >= 9 && vibration.step > 0)
})

test('missing, zero and flat signals produce useful metric scales', () => {
  const missing = [point(0, null, null)]
  assert.deepEqual(metricScale(missing, 'temperature'), { min: 20, max: 100, step: 20 })
  assert.deepEqual(metricScale(missing, 'vibration'), { min: 0, max: 4, step: 1 })
  const zero = metricScale([point(0, null, 0)], 'vibration')
  assert.equal(zero.min, 0)
  assert.ok(zero.max > zero.min && zero.step > 0)
  const flat = metricScale([point(-5000, 63), point(0, 63)], 'temperature')
  assert.ok(flat.min < 63 && flat.max > 63 && flat.step > 0)
})

test('hour ticks fall on whole minutes and adapt to the available width', () => {
  const start = hourStart + 37_000
  const end = now - 13_000
  const narrow = historyClockTicks(start, end, 260)
  const wide = historyClockTicks(start, end, 850)
  assert.ok(narrow.length >= 2 && wide.length > narrow.length && wide.length <= 8)
  for (const { value } of wide) {
    assert.equal(value % minute, 0)
    assert.ok(start <= value && value <= end)
  }
  assert.ok(wide.every(({ value }, index) => index === 0 || value > wide[index - 1].value))
})

test('24-hour ticks use multi-hour spacing on wide and narrow plots', () => {
  const start = now - 1440 * minute
  const narrow = historyClockTicks(start, now, 260)
  const wide = historyClockTicks(start, now, 850)
  assert.ok(narrow.length >= 2 && narrow.length <= 4)
  assert.ok(wide.length > narrow.length && wide.length <= 9)
  for (let index = 0; index < wide.length; index++) {
    assert.ok(start <= wide[index].value && wide[index].value <= now)
    if (index > 0) assert.ok(wide[index].value - wide[index - 1].value >= 120 * minute)
  }
})

test('daily history labels distinguish matching clock times on different dates', () => {
  const start = new Date(2026, 10, 19, 17, 15).getTime()
  const midnight = new Date(2026, 10, 20).getTime()
  const end = new Date(2026, 10, 20, 17, 15).getTime()
  assert.equal(historyRangeLabel(start, end, true), '19 Nov, 17:15 – 20 Nov, 17:15')
  assert.equal(historyRangeLabel(midnight, end, true), '20 Nov, 00:00–17:15')
  assert.deepEqual(dailyTickLabel(midnight, start), ['00:00', '20 Nov'])
  assert.equal(dailyTickLabel(end, midnight), '17:15')
})

test('recording intervals retain isolated points and split at actual telemetry gaps', () => {
  const samples = [point(-100000), point(-85000), point(-30000), point(0)]
  assert.deepEqual(recordedIntervals([], 15000), [])
  assert.deepEqual(recordedIntervals(samples, 15000), [
    { start: samples[0].time, end: samples[1].time },
    { start: samples[2].time, end: samples[2].time },
    { start: samples[3].time, end: samples[3].time },
  ])
})

test('a late HTTP refresh keeps the latest live reading and updates machine metadata', () => {
    const saved = { machineId: 'A', lastTickAtUtc: '2026-10-28T14:20:00Z', machineStatus: 'Running' }
    const machine = { machineId: 'A', state: saved, machineStatus: 'Running', workerStatus: 'Running', simulationEnabled: true }
    const live = { ...saved, lastTickAtUtc: '2026-10-28T14:20:01Z', machineStatus: 'Warning' }
    const updated = mergeLive(machine, live)
    const response = { ...machine, workerStatus: 'Stopped' }

    assert.equal(updated.machineStatus, 'Warning')
    assert.equal(mergeLive(updated, saved), updated)
    assert.deepEqual(mergeSnapshot(updated, response), { ...response, state: live })
    assert.equal(mergeSnapshot(null, response), response)
    assert.equal(mergeLive(updated, { ...live, machineId: 'B' }), updated)
})
