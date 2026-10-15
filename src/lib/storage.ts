import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface StravaAppDB extends DBSchema {
  activities: {
    key: number;
    value: any;
    indexes: { 'by-date': string };
  };
  sync_metadata: {
    key: string;
    value: any;
  };
}

let dbPromise: Promise<IDBPDatabase<StravaAppDB>>;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<StravaAppDB>('watts-next-db', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('activities')) {
          const store = db.createObjectStore('activities', { keyPath: 'id' });
          store.createIndex('by-date', 'start_date', { unique: false });
        }
        if (!db.objectStoreNames.contains('sync_metadata')) {
          db.createObjectStore('sync_metadata');
        }
      },
    });
  }
  return dbPromise;
}

export async function saveActivities(activities: any[]) {
  const db = await getDB();
  const tx = db.transaction('activities', 'readwrite');
  await Promise.all(activities.map(a => tx.store.put(a)));
  await tx.done;
}

export async function getAllActivities() {
  const db = await getDB();
  // Returns activities sorted by start_date ascending since that's what the index is on
  const all = await db.getAllFromIndex('activities', 'by-date');
  // Return descending (newest first)
  return all.reverse();
}

export async function getLastSyncTime(): Promise<number> {
  const db = await getDB();
  const val = await db.get('sync_metadata', 'last_sync_time');
  return val || 0;
}

export async function setLastSyncTime(time: number) {
  const db = await getDB();
  await db.put('sync_metadata', time, 'last_sync_time');
}
