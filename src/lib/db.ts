import Dexie, { type Table } from 'dexie';

export interface NormalizedActivity {
  id: number;
  name: string;
  start_date: string;
  start_date_local: string;
  type: string;
  sport_type: string;
  distance: number; // in meters
  moving_time: number; // in seconds
  elapsed_time: number; // in seconds
  total_elevation_gain: number; // in meters
  average_watts: number | null;
  max_watts: number | null;
  weighted_average_watts: number | null;
  device_watts: boolean;
  has_heartrate: boolean;
  average_heartrate: number | null;
  max_heartrate: number | null;
  average_cadence: number | null;
  trainer: boolean;
  commute: boolean;
  suffer_score: number | null;
  has_stream: boolean;
  raw_json?: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface ActivityStreamRecord {
  activity_id: number;
  time: number[];
  watts: number[] | null;
  heartrate: number[] | null;
  cadence: number[] | null;
  distance: number[] | null;
  altitude: number[] | null;
  fetched_at: number;
}

export interface SyncMetadataRecord {
  key: string;
  value: unknown;
  updated_at: number;
}

export const CYCLING_SPORT_TYPES = new Set([
  'Ride',
  'VirtualRide',
  'GravelRide',
  'MountainBikeRide',
  'EBikeRide',
  'EMountainBikeRide',
  'Handcycle',
  'Velomobile'
]);

export function isCyclingActivity(sportTypeOrType?: string): boolean {
  if (!sportTypeOrType) return false;
  return CYCLING_SPORT_TYPES.has(sportTypeOrType);
}

export function normalizeStravaActivity(raw: Record<string, unknown>): NormalizedActivity {
  const sportType = String(raw.sport_type || raw.type || 'Ride');

  return {
    id: Number(raw.id),
    name: String(raw.name || 'Untitled Ride'),
    start_date: typeof raw.start_date === 'string' ? raw.start_date : new Date().toISOString(),
    start_date_local: typeof raw.start_date_local === 'string' ? raw.start_date_local : (typeof raw.start_date === 'string' ? raw.start_date : new Date().toISOString()),
    type: typeof raw.type === 'string' ? raw.type : sportType,
    sport_type: sportType,
    distance: typeof raw.distance === 'number' ? raw.distance : 0,
    moving_time: typeof raw.moving_time === 'number' ? raw.moving_time : 0,
    elapsed_time: typeof raw.elapsed_time === 'number' ? raw.elapsed_time : 0,
    total_elevation_gain: typeof raw.total_elevation_gain === 'number' ? raw.total_elevation_gain : 0,
    average_watts: raw.average_watts != null ? Number(raw.average_watts) : null,
    max_watts: raw.max_watts != null ? Number(raw.max_watts) : null,
    weighted_average_watts: raw.weighted_average_watts != null ? Number(raw.weighted_average_watts) : null,
    device_watts: Boolean(raw.device_watts),
    has_heartrate: Boolean(raw.has_heartrate),
    average_heartrate: raw.average_heartrate != null ? Number(raw.average_heartrate) : null,
    max_heartrate: raw.max_heartrate != null ? Number(raw.max_heartrate) : null,
    average_cadence: raw.average_cadence != null ? Number(raw.average_cadence) : null,
    trainer: Boolean(raw.trainer),
    commute: Boolean(raw.commute),
    suffer_score: raw.suffer_score != null ? Number(raw.suffer_score) : null,
    has_stream: Boolean(raw.has_stream),
    raw_json: raw,
    created_at: typeof raw.created_at === 'number' ? raw.created_at : Date.now(),
    updated_at: Date.now()
  };
}

export class WattsNextDB extends Dexie {
  activities!: Table<NormalizedActivity, number>;
  activity_streams!: Table<ActivityStreamRecord, number>;
  sync_metadata!: Table<SyncMetadataRecord, string>;

  constructor() {
    super('watts-next-db-v2');
    this.version(1).stores({
      activities: 'id, start_date, sport_type, [sport_type+start_date]',
      activity_streams: 'activity_id, fetched_at',
      sync_metadata: 'key, updated_at'
    });
  }
}

export const db = new WattsNextDB();

// Migration helper from legacy idb 'watts-next-db'
let migrationPromise: Promise<void> | null = null;
export async function migrateLegacyDatabase(): Promise<void> {
  if (migrationPromise) return migrationPromise;

  migrationPromise = (async () => {
    try {
      const alreadyMigrated = await db.sync_metadata.get('legacy_idb_migrated');
      if (alreadyMigrated?.value) return;

      const dbs = await indexedDB.databases?.();
      const hasOldDb = dbs?.some(d => d.name === 'watts-next-db');
      if (!hasOldDb) return;

      const req = indexedDB.open('watts-next-db', 1);
      req.onsuccess = async () => {
        const oldDb = req.result;
        if (!oldDb.objectStoreNames.contains('activities')) return;

        const tx = oldDb.transaction('activities', 'readonly');
        const store = tx.objectStore('activities');
        const getAllReq = store.getAll();

        getAllReq.onsuccess = async () => {
          const oldActivities = getAllReq.result || [];
          if (oldActivities.length > 0) {
            const normalized = oldActivities
              .filter(a => isCyclingActivity(a.sport_type || a.type))
              .map(normalizeStravaActivity);
            await db.activities.bulkPut(normalized);
          }
          await db.sync_metadata.put({
            key: 'legacy_idb_migrated',
            value: true,
            updated_at: Date.now()
          });
          oldDb.close();
        };
      };
    } catch (e) {
      console.warn('Legacy DB migration skipped:', e);
    }
  })();

  return migrationPromise;
}

// Auto-run legacy migration in background
migrateLegacyDatabase();

/**
 * Upsert raw or normalized activities into Dexie.
 * Filters for cycling activities only.
 */
export async function upsertActivities(rawActivities: Record<string, unknown>[]): Promise<{ importedCount: number; totalCount: number }> {
  const cyclingActivities = rawActivities.filter(a => isCyclingActivity(String(a.sport_type || a.type || '')));
  if (cyclingActivities.length === 0) {
    const total = await db.activities.count();
    return { importedCount: 0, totalCount: total };
  }

  // Preserve existing has_stream flag if previously downloaded
  const existingIds = cyclingActivities.map(a => Number(a.id));
  const existingRecords = await db.activities.where('id').anyOf(existingIds).toArray();
  const streamMap = new Map<number, boolean>();
  existingRecords.forEach(r => {
    if (r.has_stream) streamMap.set(r.id, true);
  });

  const normalized = cyclingActivities.map(raw => {
    const norm = normalizeStravaActivity(raw);
    if (streamMap.get(norm.id)) {
      norm.has_stream = true;
    }
    return norm;
  });

  await db.activities.bulkPut(normalized);
  const totalCount = await db.activities.count();

  return {
    importedCount: normalized.length,
    totalCount
  };
}

/**
 * Get all activities ordered by start_date descending (newest first).
 */
export async function getAllActivities(): Promise<NormalizedActivity[]> {
  return db.activities.orderBy('start_date').reverse().toArray();
}

/**
 * Get activities within a lookback period (e.g. last 90 days).
 */
export async function getActivitiesSince(epochSeconds: number): Promise<NormalizedActivity[]> {
  const isoDate = new Date(epochSeconds * 1000).toISOString();
  return db.activities
    .where('start_date')
    .aboveOrEqual(isoDate)
    .reverse()
    .sortBy('start_date');
}

export async function getActivityById(id: number): Promise<NormalizedActivity | undefined> {
  return db.activities.get(id);
}

export async function getActivityStream(activityId: number): Promise<ActivityStreamRecord | undefined> {
  return db.activity_streams.get(activityId);
}

export async function saveActivityStream(record: ActivityStreamRecord): Promise<void> {
  await db.activity_streams.put(record);
  await db.activities.update(record.activity_id, {
    has_stream: true,
    updated_at: Date.now()
  });
}

export async function getLastSyncTime(): Promise<number> {
  const record = await db.sync_metadata.get('last_sync_time');
  return typeof record?.value === 'number' ? record.value : 0;
}

export async function setLastSyncTime(timestamp: number): Promise<void> {
  await db.sync_metadata.put({
    key: 'last_sync_time',
    value: timestamp,
    updated_at: Date.now()
  });
}

export async function getSyncMetadata<T = unknown>(key: string): Promise<T | null> {
  const record = await db.sync_metadata.get(key);
  return record ? (record.value as T) : null;
}

export async function setSyncMetadata(key: string, value: unknown): Promise<void> {
  await db.sync_metadata.put({
    key,
    value,
    updated_at: Date.now()
  });
}

/**
 * Complete privacy wipe: clears all IndexedDB tables, deletes legacy databases,
 * and removes local authorization tokens.
 */
export async function clearAllLocalData(): Promise<void> {
  await db.activities.clear();
  await db.activity_streams.clear();
  await db.sync_metadata.clear();

  try {
    if (typeof indexedDB !== 'undefined' && indexedDB.deleteDatabase) {
      indexedDB.deleteDatabase('watts-next-db');
    }
  } catch (e) {
    console.warn('Could not delete old database:', e);
  }

  // Clear authentication and session storage if running in browser
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('strava_access_token');
    localStorage.removeItem('strava_refresh_token');
    localStorage.removeItem('strava_expires_at');
    localStorage.removeItem('strava_athlete');
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('strava_oauth_state');
  }
}
