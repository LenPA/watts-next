import {
  db,
  upsertActivities,
  getAllActivities,
  getLastSyncTime,
  setLastSyncTime,
  clearAllLocalData,
  type NormalizedActivity
} from './db';

export {
  db,
  getAllActivities,
  getLastSyncTime,
  setLastSyncTime,
  clearAllLocalData,
  type NormalizedActivity
};

// Backward-compatible alias for existing callers
export async function saveActivities(activities: Record<string, unknown>[]) {
  return upsertActivities(activities);
}

// For legacy code that called getDB()
export async function getDB() {
  return db;
}
