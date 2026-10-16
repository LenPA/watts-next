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

export interface AthleteProfileRecord {
  id?: number;
  weight: number; // in kg
  ftp: number; // in watts
  max_heartrate: number; // in bpm
  resting_heartrate?: number; // in bpm (optional)
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'competitive';
  created_at: number;
  updated_at: number;
}

export interface FtpHistoryRecord {
  id?: number;
  ftp: number;
  effective_date: string; // YYYY-MM-DD
  note?: string;
  created_at: number;
}

export interface TrainingGoalRecord {
  id?: number;
  type: 'ftp_increase' | 'gran_fondo' | 'endurance_base' | 'general_fitness' | 'racing';
  title: string;
  target_date?: string; // YYYY-MM-DD
  target_ftp?: number;
  target_hours_per_week?: number;
  description?: string;
  active: boolean;
  created_at: number;
}

export interface AvailabilityRecord {
  id?: number;
  day_of_week: number; // 0=Monday, 1=Tuesday, ..., 6=Sunday
  day_name: string; // 'Maandag', etc.
  minutes: number;
  preference: 'indoor' | 'outdoor' | 'both' | 'rest';
  updated_at: number;
}

export class WattsNextDB extends Dexie {
  activities!: Table<NormalizedActivity, number>;
  activity_streams!: Table<ActivityStreamRecord, number>;
  sync_metadata!: Table<SyncMetadataRecord, string>;
  athlete_profile!: Table<AthleteProfileRecord, number>;
  ftp_history!: Table<FtpHistoryRecord, number>;
  training_goals!: Table<TrainingGoalRecord, number>;
  availability!: Table<AvailabilityRecord, number>;

  constructor() {
    super('watts-next-db-v2');
    this.version(1).stores({
      activities: 'id, start_date, sport_type, [sport_type+start_date]',
      activity_streams: 'activity_id, fetched_at',
      sync_metadata: 'key, updated_at'
    });
    this.version(2).stores({
      activities: 'id, start_date, sport_type, [sport_type+start_date]',
      activity_streams: 'activity_id, fetched_at',
      sync_metadata: 'key, updated_at',
      athlete_profile: '++id, updated_at',
      ftp_history: '++id, effective_date, created_at',
      training_goals: '++id, type, active, created_at',
      availability: '++id, day_of_week'
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

// ==========================================
// Athlete Profile & FTP History Helpers
// ==========================================

export async function getAthleteProfile(): Promise<AthleteProfileRecord | null> {
  const profile = await db.athlete_profile.orderBy('updated_at').last();
  return profile || null;
}

export async function saveAthleteProfile(
  profile: Omit<AthleteProfileRecord, 'updated_at'> & { updated_at?: number }
): Promise<AthleteProfileRecord> {
  const existing = await getAthleteProfile();
  const record: AthleteProfileRecord = {
    ...profile,
    id: existing?.id || profile.id,
    updated_at: Date.now()
  };

  const id = await db.athlete_profile.put(record);
  record.id = id;

  // Also add to FTP history if FTP changed or this is first profile
  const history = await getFtpHistory();
  const latestFtp = history[history.length - 1];
  if (!latestFtp || latestFtp.ftp !== profile.ftp) {
    await addFtpHistory(profile.ftp, new Date().toISOString().split('T')[0], 'Profiel update');
  }

  return record;
}

export async function getFtpHistory(): Promise<FtpHistoryRecord[]> {
  return db.ftp_history.orderBy('effective_date').toArray();
}

export async function addFtpHistory(
  ftp: number,
  effectiveDate: string,
  note?: string
): Promise<FtpHistoryRecord> {
  const record: FtpHistoryRecord = {
    ftp: Math.round(ftp),
    effective_date: effectiveDate,
    note,
    created_at: Date.now()
  };
  const id = await db.ftp_history.add(record);
  return { ...record, id };
}

export async function getEffectiveFtpForDate(dateIso: string, fallbackFtp: number = 250): Promise<number> {
  const dateKey = dateIso.split('T')[0];
  const history = await db.ftp_history.where('effective_date').belowOrEqual(dateKey).sortBy('effective_date');
  if (history.length > 0) {
    return history[history.length - 1].ftp;
  }
  const profile = await getAthleteProfile();
  return profile?.ftp || fallbackFtp;
}

// ==========================================
// Training Goals Helpers
// ==========================================

export async function getTrainingGoals(): Promise<TrainingGoalRecord[]> {
  return db.training_goals.orderBy('created_at').reverse().toArray();
}

export async function getActiveTrainingGoal(): Promise<TrainingGoalRecord | null> {
  const all = await db.training_goals.toArray();
  const active = all.find(g => Boolean(g.active));
  if (active) return active;
  // Fallback to latest goal
  const latest = await db.training_goals.orderBy('created_at').last();
  return latest || null;
}

export async function saveTrainingGoal(
  goal: Omit<TrainingGoalRecord, 'created_at'> & { created_at?: number }
): Promise<TrainingGoalRecord> {
  if (goal.active) {
    // Deactivate other goals to have single primary active goal
    const all = await db.training_goals.toArray();
    for (const g of all) {
      if (g.id !== goal.id && g.active) {
        await db.training_goals.update(g.id!, { active: false });
      }
    }
  }

  const record: TrainingGoalRecord = {
    ...goal,
    created_at: goal.created_at || Date.now()
  };

  const id = await db.training_goals.put(record);
  return { ...record, id };
}

// ==========================================
// Availability Schedule Helpers
// ==========================================

export const DEFAULT_WEEK_AVAILABILITY: Omit<AvailabilityRecord, 'id' | 'updated_at'>[] = [
  { day_of_week: 0, day_name: 'Maandag', minutes: 0, preference: 'rest' },
  { day_of_week: 1, day_name: 'Dinsdag', minutes: 75, preference: 'both' },
  { day_of_week: 2, day_name: 'Woensdag', minutes: 90, preference: 'both' },
  { day_of_week: 3, day_name: 'Donderdag', minutes: 60, preference: 'both' },
  { day_of_week: 4, day_name: 'Vrijdag', minutes: 0, preference: 'rest' },
  { day_of_week: 5, day_name: 'Zaterdag', minutes: 180, preference: 'outdoor' },
  { day_of_week: 6, day_name: 'Zondag', minutes: 120, preference: 'outdoor' }
];

export async function getWeeklyAvailability(): Promise<AvailabilityRecord[]> {
  const records = await db.availability.orderBy('day_of_week').toArray();
  if (records.length === 7) return records;

  // Initialize with defaults if empty or incomplete
  await db.availability.clear();
  const now = Date.now();
  const initRecords: AvailabilityRecord[] = DEFAULT_WEEK_AVAILABILITY.map(d => ({
    ...d,
    updated_at: now
  }));
  await db.availability.bulkAdd(initRecords);
  return db.availability.orderBy('day_of_week').toArray();
}

export async function saveWeeklyAvailability(
  schedule: Omit<AvailabilityRecord, 'id' | 'updated_at'>[]
): Promise<AvailabilityRecord[]> {
  await db.availability.clear();
  const now = Date.now();
  const records: AvailabilityRecord[] = schedule.map((d, index) => ({
    ...d,
    day_of_week: d.day_of_week !== undefined ? d.day_of_week : index,
    updated_at: now
  }));
  await db.availability.bulkAdd(records);
  return db.availability.orderBy('day_of_week').toArray();
}

/**
 * Complete privacy wipe: clears all IndexedDB tables, deletes legacy databases,
 * and removes local authorization tokens.
 */
export async function clearAllLocalData(): Promise<void> {
  await db.activities.clear();
  await db.activity_streams.clear();
  await db.sync_metadata.clear();
  await db.athlete_profile.clear();
  await db.ftp_history.clear();
  await db.training_goals.clear();
  await db.availability.clear();

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
    localStorage.removeItem('strava_user_ftp');
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('strava_oauth_state');
  }
}

