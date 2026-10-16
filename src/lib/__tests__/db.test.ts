import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  db,
  normalizeStravaActivity,
  isCyclingActivity,
  upsertActivities,
  getAllActivities,
  saveActivityStream,
  getActivityStream,
  clearAllLocalData
} from '../db';

describe('Strava Activity Normalization & Filter', () => {
  it('correctly identifies cycling activities and rejects non-cycling activities', () => {
    expect(isCyclingActivity('Ride')).toBe(true);
    expect(isCyclingActivity('VirtualRide')).toBe(true);
    expect(isCyclingActivity('GravelRide')).toBe(true);
    expect(isCyclingActivity('MountainBikeRide')).toBe(true);
    expect(isCyclingActivity('EBikeRide')).toBe(true);

    expect(isCyclingActivity('Run')).toBe(false);
    expect(isCyclingActivity('Swim')).toBe(false);
    expect(isCyclingActivity('WeightTraining')).toBe(false);
    expect(isCyclingActivity(undefined)).toBe(false);
  });

  it('preserves null for missing metrics instead of defaulting to 0', () => {
    const rawRideWithoutSensors = {
      id: 12345,
      name: 'Sunday Coffee Ride',
      start_date: '2026-10-10T09:00:00Z',
      distance: 35000,
      moving_time: 4200,
      type: 'Ride'
      // average_watts, average_heartrate, suffer_score are omitted
    };

    const normalized = normalizeStravaActivity(rawRideWithoutSensors);

    expect(normalized.id).toBe(12345);
    expect(normalized.name).toBe('Sunday Coffee Ride');
    expect(normalized.average_watts).toBeNull();
    expect(normalized.weighted_average_watts).toBeNull();
    expect(normalized.max_watts).toBeNull();
    expect(normalized.average_heartrate).toBeNull();
    expect(normalized.average_cadence).toBeNull();
    expect(normalized.suffer_score).toBeNull();
    expect(normalized.has_stream).toBe(false);
  });

  it('normalizes power and heart rate when present', () => {
    const rawWithSensors = {
      id: 67890,
      name: 'Interval Session',
      start_date: '2026-10-12T18:00:00Z',
      distance: 28000,
      moving_time: 3600,
      type: 'VirtualRide',
      average_watts: 245.5,
      weighted_average_watts: 262,
      max_watts: 650,
      has_heartrate: true,
      average_heartrate: 158,
      max_heartrate: 182,
      average_cadence: 88,
      suffer_score: 95
    };

    const normalized = normalizeStravaActivity(rawWithSensors);

    expect(normalized.average_watts).toBe(245.5);
    expect(normalized.weighted_average_watts).toBe(262);
    expect(normalized.max_watts).toBe(650);
    expect(normalized.average_heartrate).toBe(158);
    expect(normalized.average_cadence).toBe(88);
    expect(normalized.suffer_score).toBe(95);
  });
});

describe('Dexie Database Operations', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it('upserts cycling activities and filters non-cycling activities', async () => {
    const rawActivities = [
      { id: 101, name: 'Z2 Endurance Ride', start_date: '2026-10-01T10:00:00Z', type: 'Ride', distance: 50000 },
      { id: 102, name: 'Morning 5k Run', start_date: '2026-10-02T07:00:00Z', type: 'Run', distance: 5000 },
      { id: 103, name: 'Gravel Adventure', start_date: '2026-10-03T09:00:00Z', type: 'GravelRide', distance: 65000 }
    ];

    const result = await upsertActivities(rawActivities);
    expect(result.importedCount).toBe(2);
    expect(result.totalCount).toBe(2);

    const stored = await getAllActivities();
    expect(stored.length).toBe(2);
    // Ordered descending by start_date
    expect(stored[0].id).toBe(103);
    expect(stored[1].id).toBe(101);
  });

  it('deduplicates existing activities on second sync', async () => {
    const rawRides = [
      { id: 201, name: 'Original Name', start_date: '2026-10-05T10:00:00Z', type: 'Ride' }
    ];
    await upsertActivities(rawRides);

    // Second sync with updated name
    const updatedRides = [
      { id: 201, name: 'Updated Name After Edit', start_date: '2026-10-05T10:00:00Z', type: 'Ride' }
    ];
    const result = await upsertActivities(updatedRides);

    expect(result.totalCount).toBe(1);
    const stored = await getAllActivities();
    expect(stored[0].name).toBe('Updated Name After Edit');
  });

  it('saves lazy telemetry stream and updates has_stream flag on activity', async () => {
    await upsertActivities([
      { id: 301, name: 'Threshold Workout', start_date: '2026-10-08T12:00:00Z', type: 'VirtualRide' }
    ]);

    let act = (await getAllActivities())[0];
    expect(act.has_stream).toBe(false);

    // Save lazy telemetry stream
    await saveActivityStream({
      activity_id: 301,
      time: [0, 1, 2, 3],
      watts: [200, 250, 300, 310],
      heartrate: [140, 145, 150, 155],
      cadence: [85, 88, 90, 91],
      distance: [0, 8, 16, 24],
      altitude: null,
      fetched_at: Date.now()
    });

    const stream = await getActivityStream(301);
    expect(stream).toBeDefined();
    expect(stream?.watts).toEqual([200, 250, 300, 310]);

    // Activity record is updated to reflect stream is cached
    act = (await getAllActivities())[0];
    expect(act.has_stream).toBe(true);
  });

  it('clears all data on privacy wipe', async () => {
    await upsertActivities([
      { id: 401, name: 'Ride to Delete', start_date: '2026-10-09T10:00:00Z', type: 'Ride' }
    ]);

    expect(await db.activities.count()).toBe(1);
    await clearAllLocalData();
    expect(await db.activities.count()).toBe(0);
  });
});

describe('Phase 2 Dexie Tables: Profile, Goals & Availability', () => {
  beforeEach(async () => {
    await clearAllLocalData();
  });

  it('stores and retrieves athlete profile, and updates ftp history automatically', async () => {
    const { getAthleteProfile, saveAthleteProfile, getFtpHistory } = await import('../db');

    const profile = await saveAthleteProfile({
      weight: 72.5,
      ftp: 280,
      max_heartrate: 192,
      resting_heartrate: 48,
      experience_level: 'advanced',
      created_at: Date.now()
    });

    expect(profile.id).toBeDefined();

    const retrieved = await getAthleteProfile();
    expect(retrieved?.ftp).toBe(280);
    expect(retrieved?.weight).toBe(72.5);
    expect(retrieved?.experience_level).toBe('advanced');

    const ftpHistory = await getFtpHistory();
    expect(ftpHistory.length).toBe(1);
    expect(ftpHistory[0].ftp).toBe(280);
  });

  it('resolves historical FTP according to date of activity', async () => {
    const { addFtpHistory, getEffectiveFtpForDate } = await import('../db');

    // In July FTP was 240, in September upgraded to 260, in October upgraded to 280
    await addFtpHistory(240, '2026-07-01', 'Baseline test');
    await addFtpHistory(260, '2026-09-01', 'Ramp test');
    await addFtpHistory(280, '2026-10-01', 'Post-block test');

    const ftpAug = await getEffectiveFtpForDate('2026-08-15T10:00:00Z');
    expect(ftpAug).toBe(240);

    const ftpSep = await getEffectiveFtpForDate('2026-09-20T10:00:00Z');
    expect(ftpSep).toBe(260);

    const ftpOct = await getEffectiveFtpForDate('2026-10-15T10:00:00Z');
    expect(ftpOct).toBe(280);
  });

  it('stores and retrieves training goals with single active goal guarantee', async () => {
    const { saveTrainingGoal, getActiveTrainingGoal, getTrainingGoals } = await import('../db');

    await saveTrainingGoal({
      type: 'gran_fondo',
      title: 'Marmotte Alpes 2027',
      target_date: '2027-07-04',
      target_hours_per_week: 10,
      active: true
    });

    const active1 = await getActiveTrainingGoal();
    expect(active1?.title).toBe('Marmotte Alpes 2027');

    // Save a new active goal
    await saveTrainingGoal({
      type: 'ftp_increase',
      title: 'Verbreek 300W grens',
      target_ftp: 305,
      active: true
    });

    const active2 = await getActiveTrainingGoal();
    expect(active2?.title).toBe('Verbreek 300W grens');

    const allGoals = await getTrainingGoals();
    expect(allGoals.length).toBe(2);
    // Previous goal was automatically deactivated
    const prevGoal = allGoals.find(g => g.title === 'Marmotte Alpes 2027');
    expect(prevGoal?.active).toBe(false);
  });

  it('provides default availability and persists custom schedule', async () => {
    const { getWeeklyAvailability, saveWeeklyAvailability } = await import('../db');

    const defaults = await getWeeklyAvailability();
    expect(defaults.length).toBe(7);
    expect(defaults[0].day_name).toBe('Maandag');

    // Customize Wednesday to 120 mins indoor
    const customized = defaults.map(d => 
      d.day_name === 'Woensdag' 
        ? { ...d, minutes: 120, preference: 'indoor' as const } 
        : d
    );
    await saveWeeklyAvailability(customized);

    const updated = await getWeeklyAvailability();
    const wed = updated.find(d => d.day_name === 'Woensdag');
    expect(wed?.minutes).toBe(120);
    expect(wed?.preference).toBe('indoor');
  });
});

