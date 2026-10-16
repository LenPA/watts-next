/**
 * Data Management, Backup & Storage Persistence for Watts Next
 * 
 * Supports:
 * - Full JSON database export (all Dexie tables + user settings)
 * - Safe JSON import with schema validation & atomic restoration
 * - navigator.storage.persist() API check and activation
 */

import { db, type NormalizedActivity, type ActivityStreamRecord, type AthleteProfileRecord, type TrainingGoalRecord, type AvailabilityRecord, type FtpHistoryRecord, type SyncMetadataRecord } from './db';

export interface WattsNextBackupPayload {
  app: 'watts-next';
  version: number;
  exportedAt: string;
  data: {
    activities: NormalizedActivity[];
    activity_streams: ActivityStreamRecord[];
    sync_metadata: SyncMetadataRecord[];
    athlete_profile: AthleteProfileRecord[];
    ftp_history: FtpHistoryRecord[];
    training_goals: TrainingGoalRecord[];
    availability: AvailabilityRecord[];
    localStorage?: Record<string, string>;
  };
}

export interface ImportResult {
  success: boolean;
  importedActivities: number;
  importedStreams: number;
  message?: string;
  error?: string;
}

export interface StorageStatus {
  isPersistent: boolean;
  supported: boolean;
  usageBytes?: number;
  quotaBytes?: number;
  usageFormatted?: string;
  quotaFormatted?: string;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * Checks whether IndexedDB storage is marked as persistent against automatic browser cleanup
 */
export async function checkStoragePersistence(): Promise<StorageStatus> {
  if (typeof window === 'undefined' || !navigator.storage) {
    return { isPersistent: false, supported: false };
  }

  try {
    const isPersistent = navigator.storage.persisted ? await navigator.storage.persisted() : false;
    let estimate: StorageEstimate | undefined;
    if (navigator.storage.estimate) {
      estimate = await navigator.storage.estimate();
    }

    return {
      isPersistent,
      supported: true,
      usageBytes: estimate?.usage,
      quotaBytes: estimate?.quota,
      usageFormatted: formatBytes(estimate?.usage),
      quotaFormatted: formatBytes(estimate?.quota)
    };
  } catch (err) {
    console.warn('Failed to check storage persistence:', err);
    return { isPersistent: false, supported: false };
  }
}

/**
 * Requests browser permission to make IndexedDB persistent
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.storage?.persist) {
    return false;
  }

  try {
    return await navigator.storage.persist();
  } catch (err) {
    console.warn('Failed to request persistent storage:', err);
    return false;
  }
}

/**
 * Exports all IndexedDB data and user preferences to a JSON string
 */
export async function exportFullDatabaseJson(): Promise<string> {
  const [
    activities,
    activity_streams,
    sync_metadata,
    athlete_profile,
    ftp_history,
    training_goals,
    availability
  ] = await Promise.all([
    db.activities.toArray(),
    db.activity_streams.toArray(),
    db.sync_metadata.toArray(),
    db.athlete_profile.toArray(),
    db.ftp_history.toArray(),
    db.training_goals.toArray(),
    db.availability.toArray()
  ]);

  const lsData: Record<string, string> = {};
  if (typeof window !== 'undefined' && window.localStorage) {
    const keys = ['watts_theme', 'watts_workout_overrides', 'strava_user_ftp'];
    for (const k of keys) {
      const val = localStorage.getItem(k);
      if (val !== null) lsData[k] = val;
    }
  }

  const payload: WattsNextBackupPayload = {
    app: 'watts-next',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      activities,
      activity_streams,
      sync_metadata,
      athlete_profile,
      ftp_history,
      training_goals,
      availability,
      localStorage: lsData
    }
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Triggers a download of the full database backup in the browser
 */
export async function downloadDatabaseBackupFile(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  try {
    const json = await exportFullDatabaseJson();
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `watts-next-backup-${dateStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Failed to download backup JSON:', err);
    return false;
  }
}

/**
 * Imports a previously exported JSON backup into IndexedDB
 */
export async function importFullDatabaseJson(jsonString: string): Promise<ImportResult> {
  try {
    const parsed = JSON.parse(jsonString) as WattsNextBackupPayload;

    if (!parsed || parsed.app !== 'watts-next' || !parsed.data) {
      return {
        success: false,
        importedActivities: 0,
        importedStreams: 0,
        error: 'Ongeldig backup-bestand. Het bestand moet gegenereerd zijn door Watts Next.'
      };
    }

    const {
      activities = [],
      activity_streams = [],
      sync_metadata = [],
      athlete_profile = [],
      ftp_history = [],
      training_goals = [],
      availability = [],
      localStorage: lsData
    } = parsed.data;

    // Execute atomic transaction across all Dexie tables
    await db.transaction('rw', [
      db.activities,
      db.activity_streams,
      db.sync_metadata,
      db.athlete_profile,
      db.ftp_history,
      db.training_goals,
      db.availability
    ], async () => {
      // Clear existing records
      await Promise.all([
        db.activities.clear(),
        db.activity_streams.clear(),
        db.sync_metadata.clear(),
        db.athlete_profile.clear(),
        db.ftp_history.clear(),
        db.training_goals.clear(),
        db.availability.clear()
      ]);

      // Bulk insert imported data
      if (activities.length > 0) await db.activities.bulkPut(activities);
      if (activity_streams.length > 0) await db.activity_streams.bulkPut(activity_streams);
      if (sync_metadata.length > 0) await db.sync_metadata.bulkPut(sync_metadata);
      if (athlete_profile.length > 0) await db.athlete_profile.bulkPut(athlete_profile);
      if (ftp_history.length > 0) await db.ftp_history.bulkPut(ftp_history);
      if (training_goals.length > 0) await db.training_goals.bulkPut(training_goals);
      if (availability.length > 0) await db.availability.bulkPut(availability);
    });

    // Restore localStorage items if present
    if (lsData && typeof window !== 'undefined' && window.localStorage) {
      for (const [k, v] of Object.entries(lsData)) {
        try {
          localStorage.setItem(k, v);
        } catch {
          // ignore storage errors
        }
      }
    }

    return {
      success: true,
      importedActivities: activities.length,
      importedStreams: activity_streams.length,
      message: `Succesvol hersteld: ${activities.length} ritten, ${activity_streams.length} datastreams en je persoonlijke instellingen.`
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      importedActivities: 0,
      importedStreams: 0,
      error: `Fout bij inlezen van JSON-bestand: ${message}`
    };
  }
}
