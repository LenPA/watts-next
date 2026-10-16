import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db';
import { exportFullDatabaseJson, importFullDatabaseJson } from '../dataManagement';

describe('Data Management & JSON Backup/Restore', () => {
  beforeEach(async () => {
    await db.activities.clear();
    await db.athlete_profile.clear();
  });

  it('exports and re-imports database records cleanly', async () => {
    // Insert test activity
    await db.activities.add({
      id: 55555,
      name: 'Backup Test Ride',
      start_date: '2026-10-16T12:00:00Z',
      start_date_local: '2026-10-16T14:00:00',
      type: 'Ride',
      sport_type: 'Ride',
      distance: 30000,
      moving_time: 3600,
      elapsed_time: 3700,
      total_elevation_gain: 150,
      average_watts: 200,
      max_watts: 400,
      weighted_average_watts: 215,
      device_watts: true,
      has_heartrate: true,
      average_heartrate: 145,
      max_heartrate: 170,
      average_cadence: 88,
      trainer: false,
      commute: false,
      suffer_score: 75,
      has_stream: false,
      created_at: Date.now(),
      updated_at: Date.now()
    });

    const json = await exportFullDatabaseJson();
    expect(json).toContain('"app": "watts-next"');
    expect(json).toContain('Backup Test Ride');

    // Clear db
    await db.activities.clear();
    const countBefore = await db.activities.count();
    expect(countBefore).toBe(0);

    // Import
    const res = await importFullDatabaseJson(json);
    expect(res.success).toBe(true);
    expect(res.importedActivities).toBe(1);

    const countAfter = await db.activities.count();
    expect(countAfter).toBe(1);
    const restored = await db.activities.get(55555);
    expect(restored?.name).toBe('Backup Test Ride');
  });

  it('rejects invalid JSON or incompatible schema files', async () => {
    const res = await importFullDatabaseJson('{ "app": "other-app", "version": 99 }');
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});
