import { describe, it, expect } from 'vitest';
import {
  calculatePowerZones,
  calculateZoneDistribution,
  calculateNormalizedPower,
  calculateIntensityFactor,
  calculateCogganTss,
  calculateActivityPhysiology,
  calculateFitnessTrends
} from '../physiology';
import type { NormalizedActivity, ActivityStreamRecord } from '../db';

describe('Coggan 7-Zone Model & Sweet Spot', () => {
  it('calculates correct power zones for 250W FTP', () => {
    const zones = calculatePowerZones(250);
    
    // Z1: < 55% -> 0 to 138W
    const z1 = zones.find(z => z.code === 'Z1');
    expect(z1?.maxWatts).toBe(138);

    // Z2: 55-75% -> 139 to 188W
    const z2 = zones.find(z => z.code === 'Z2');
    expect(z2?.minWatts).toBe(139);
    expect(z2?.maxWatts).toBe(188);

    // Sweet Spot: 88-93% -> 220 to 233W
    const ss = zones.find(z => z.code === 'SS');
    expect(ss?.minWatts).toBe(220);
    expect(ss?.maxWatts).toBe(233);

    // Z4 Threshold: 91-105% -> 228 to 263W
    const z4 = zones.find(z => z.code === 'Z4');
    expect(z4?.minWatts).toBe(228);
    expect(z4?.maxWatts).toBe(263);

    // Z5 VO2Max: 106-120% -> 265 to 300W
    const z5 = zones.find(z => z.code === 'Z5');
    expect(z5?.minWatts).toBe(265);
    expect(z5?.maxWatts).toBe(300);
  });

  it('calculates zone distribution percentages accurately', () => {
    // 100 seconds: 50s in Z2 (150W), 50s in Z4 (250W) with FTP 250
    const watts = [...Array(50).fill(150), ...Array(50).fill(250)];
    const dist = calculateZoneDistribution(watts, 250);

    const z2 = dist.find(d => d.zoneCode === 'Z2');
    const z4 = dist.find(d => d.zoneCode === 'Z4');

    expect(z2?.seconds).toBe(50);
    expect(z2?.percentage).toBe(50);
    expect(z4?.seconds).toBe(50);
    expect(z4?.percentage).toBe(50);
  });
});

describe('Normalized Power (NP), IF & Coggan TSS', () => {
  it('returns null for empty watts stream', () => {
    expect(calculateNormalizedPower([])).toBeNull();
  });

  it('calculates steady state NP identical to average power', () => {
    // 60 seconds of steady 200W
    const watts = Array(60).fill(200);
    const np = calculateNormalizedPower(watts);
    expect(np).toBe(200);
  });

  it('weights high-intensity surges higher than average power (stochastic effort)', () => {
    // 60 seconds alternating between 100W and 300W (avg = 200W)
    const watts: number[] = [];
    for (let i = 0; i < 60; i++) {
      watts.push(i % 2 === 0 ? 100 : 300);
    }
    const avg = watts.reduce((a, b) => a + b, 0) / watts.length;
    expect(avg).toBe(200);

    const np = calculateNormalizedPower(watts);
    expect(np).toBeDefined();
    // Due to 4th power weighting, NP should be higher than simple average for stochastic efforts
    // In this rapid 1s alternation, 30s rolling avg dampens slightly, but test with longer 30s block:
    const blockWatts = [...Array(30).fill(100), ...Array(30).fill(300), ...Array(30).fill(100), ...Array(30).fill(300)];
    const blockNp = calculateNormalizedPower(blockWatts);
    expect(blockNp).toBeGreaterThan(200);
  });

  it('calculates Intensity Factor (IF) accurately', () => {
    expect(calculateIntensityFactor(250, 250)).toBe(1.0);
    expect(calculateIntensityFactor(200, 250)).toBe(0.8);
    expect(calculateIntensityFactor(275, 250)).toBe(1.1);
  });

  it('calculates Coggan TSS accurately for 1 hour at threshold', () => {
    // 1 hour (3600s) at exactly FTP (NP = 250, FTP = 250) -> TSS must equal 100
    const tss = calculateCogganTss(3600, 250, 250);
    expect(tss).toBe(100);

    // 2 hours at 0.70 IF -> TSS = 2 * 0.70^2 * 100 = 2 * 0.49 * 100 = 98
    const tss2 = calculateCogganTss(7200, 175, 250);
    expect(tss2).toBe(98);
  });
});

describe('Data Provenance Hierarchy', () => {
  const baseRide: NormalizedActivity = {
    id: 1001,
    name: 'Evening Ride',
    start_date: '2026-10-15T18:00:00Z',
    start_date_local: '2026-10-15T18:00:00Z',
    type: 'Ride',
    sport_type: 'Ride',
    distance: 30000,
    moving_time: 3600,
    elapsed_time: 3800,
    total_elevation_gain: 150,
    average_watts: null,
    max_watts: null,
    weighted_average_watts: null,
    device_watts: false,
    has_heartrate: false,
    average_heartrate: null,
    max_heartrate: null,
    average_cadence: null,
    trainer: false,
    commute: false,
    suffer_score: null,
    has_stream: false,
    created_at: Date.now(),
    updated_at: Date.now()
  };

  it('prefers measured second-stream if present (Tier 1)', () => {
    const stream: ActivityStreamRecord = {
      activity_id: 1001,
      time: Array.from({ length: 60 }, (_, i) => i),
      watts: Array(60).fill(250),
      heartrate: null,
      cadence: null,
      distance: null,
      altitude: null,
      fetched_at: Date.now()
    };

    const res = calculateActivityPhysiology({ ...baseRide, weighted_average_watts: 200 }, 250, stream);
    expect(res.provenance).toBe('measured_stream');
    expect(res.isEstimated).toBe(false);
    expect(res.np).toBe(250);
    expect(res.load).toBe(100);
  });

  it('falls back to Strava weighted watts if no stream available (Tier 2)', () => {
    const rideWithWeighted = {
      ...baseRide,
      weighted_average_watts: 225
    };

    const res = calculateActivityPhysiology(rideWithWeighted, 250, null);
    expect(res.provenance).toBe('calculated_weighted');
    expect(res.isEstimated).toBe(false);
    expect(res.np).toBe(225);
    expect(res.if).toBe(0.9);
    // TSS = 3600 * 225 * 0.9 / (250 * 36) = 81
    expect(res.load).toBe(81);
  });

  it('falls back to heart rate estimation if no power available (Tier 3)', () => {
    const rideWithHr = {
      ...baseRide,
      has_heartrate: true,
      average_heartrate: 155,
      max_heartrate: 185
    };

    const res = calculateActivityPhysiology(rideWithHr, 250, null, 190);
    expect(res.provenance).toBe('estimated_heartrate');
    expect(res.isEstimated).toBe(true);
    expect(res.np).toBeNull();
    expect(res.load).toBeGreaterThan(0);
  });

  it('falls back to suffer score if no power or HR (Tier 4)', () => {
    const rideWithSuffer = {
      ...baseRide,
      suffer_score: 65
    };

    const res = calculateActivityPhysiology(rideWithSuffer, 250, null);
    expect(res.provenance).toBe('estimated_suffer_score');
    expect(res.isEstimated).toBe(true);
    expect(res.load).toBe(65);
  });

  it('falls back to duration proxy if no metrics at all (Tier 5)', () => {
    const res = calculateActivityPhysiology(baseRide, 250, null);
    expect(res.provenance).toBe('estimated_time');
    expect(res.isEstimated).toBe(true);
    // 3600s = 1 hr -> 40 TSS
    expect(res.load).toBe(40);
  });
});

describe('EWMA Fitness Trends (ATL, CTL, TSB)', () => {
  it('correctly calculates exponential decay and TSB = CTL_yesterday - ATL_yesterday', () => {
    const mockActivities: NormalizedActivity[] = [
      {
        id: 1,
        name: 'Hard Ride Day 1',
        start_date: new Date(Date.now() - 3 * 86400000).toISOString(),
        start_date_local: new Date(Date.now() - 3 * 86400000).toISOString(),
        type: 'Ride',
        sport_type: 'Ride',
        distance: 40000,
        moving_time: 3600,
        elapsed_time: 3600,
        total_elevation_gain: 200,
        average_watts: 250,
        max_watts: 400,
        weighted_average_watts: 250,
        device_watts: true,
        has_heartrate: false,
        average_heartrate: null,
        max_heartrate: null,
        average_cadence: null,
        trainer: false,
        commute: false,
        suffer_score: null,
        has_stream: false,
        created_at: Date.now(),
        updated_at: Date.now()
      }
    ];

    const trends = calculateFitnessTrends(mockActivities, 250, { days: 10 });
    expect(trends.series.length).toBe(10);

    // Initial days with 0 TSS should have 0 CTL and 0 ATL
    expect(trends.series[0].dailyTss).toBe(0);

    // On any given day, TSB should equal previous day CTL - previous day ATL
    for (let i = 1; i < trends.series.length; i++) {
      const prev = trends.series[i - 1];
      const curr = trends.series[i];
      const expectedTsb = Math.round((prev.ctl - prev.atl) * 10) / 10;
      expect(curr.tsb).toBeCloseTo(expectedTsb, 0);
    }

    // Acute fatigue (ATL, 7d) reacts much faster to TSS than chronic fitness (CTL, 42d)
    const dayOfWorkout = trends.series.find(s => s.dailyTss > 0);
    if (dayOfWorkout) {
      expect(dayOfWorkout.atl).toBeGreaterThan(dayOfWorkout.ctl);
    }
  });

  it('preserves historical CTL/ATL calculation independently of chart display period (30 vs 60 vs 90 days)', () => {
    // Athlete with activities going back 120 days
    const mockLongHistory: NormalizedActivity[] = [
      {
        id: 101,
        name: 'Century Ride 100 days ago',
        start_date: new Date(Date.now() - 100 * 86400000).toISOString(),
        start_date_local: new Date(Date.now() - 100 * 86400000).toISOString(),
        type: 'Ride',
        sport_type: 'Ride',
        distance: 100000,
        moving_time: 14400,
        elapsed_time: 15000,
        total_elevation_gain: 800,
        average_watts: 200,
        max_watts: 450,
        weighted_average_watts: 210,
        device_watts: true,
        has_heartrate: false,
        average_heartrate: null,
        max_heartrate: null,
        average_cadence: null,
        trainer: false,
        commute: false,
        suffer_score: null,
        has_stream: false,
        created_at: Date.now(),
        updated_at: Date.now()
      },
      {
        id: 102,
        name: 'Threshold intervals 20 days ago',
        start_date: new Date(Date.now() - 20 * 86400000).toISOString(),
        start_date_local: new Date(Date.now() - 20 * 86400000).toISOString(),
        type: 'Ride',
        sport_type: 'Ride',
        distance: 40000,
        moving_time: 3600,
        elapsed_time: 3600,
        total_elevation_gain: 200,
        average_watts: 250,
        max_watts: 400,
        weighted_average_watts: 250,
        device_watts: true,
        has_heartrate: false,
        average_heartrate: null,
        max_heartrate: null,
        average_cadence: null,
        trainer: false,
        commute: false,
        suffer_score: null,
        has_stream: false,
        created_at: Date.now(),
        updated_at: Date.now()
      }
    ];

    const view30 = calculateFitnessTrends(mockLongHistory, 250, { days: 30 });
    const view60 = calculateFitnessTrends(mockLongHistory, 250, { days: 60 });
    const view90 = calculateFitnessTrends(mockLongHistory, 250, { days: 90 });

    // The series length must match the requested display window
    expect(view30.series.length).toBe(30);
    expect(view60.series.length).toBe(60);
    expect(view90.series.length).toBe(90);

    // Current CTL, ATL, and TSB on today must be IDENTICAL across all views!
    expect(view30.currentCtl).toBe(view90.currentCtl);
    expect(view30.currentAtl).toBe(view90.currentAtl);
    expect(view30.currentTsb).toBe(view90.currentTsb);

    // Due to the ride 100 days ago, CTL on today should be > 0 in all views, not reset to 0
    expect(view30.currentCtl).toBeGreaterThan(0);

    // Overlapping dates between view30 and view90 must have identical values
    const latest30 = view30.series[view30.series.length - 1];
    const latest90 = view90.series[view90.series.length - 1];
    expect(latest30.ctl).toBe(latest90.ctl);
    expect(latest30.atl).toBe(latest90.atl);
    expect(latest30.tsb).toBe(latest90.tsb);
  });
});
