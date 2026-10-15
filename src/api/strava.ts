import {
  upsertActivities,
  getLastSyncTime,
  setLastSyncTime,
  getActivityStream,
  saveActivityStream,
  type ActivityStreamRecord
} from '../lib/db';

const CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID || '213326';
const CLIENT_SECRET = import.meta.env.VITE_STRAVA_CLIENT_SECRET || '';

/**
 * Generate a Strava OAuth authorization URL with CSRF state protection.
 */
export function getStravaAuthUrl(): string {
  const state = crypto.randomUUID();
  sessionStorage.setItem('strava_oauth_state', state);

  const redirectUri = window.location.origin;
  const scope = 'read,activity:read_all';

  return `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&approval_prompt=force&scope=${scope}&state=${state}`;
}

export const STRAVA_AUTH_URL = getStravaAuthUrl();

export interface TokenResponse {
  token_type: string;
  access_token: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  athlete?: Record<string, unknown>;
}

/**
 * Exchange authorization code for access and refresh tokens.
 * Uses the serverless / dev proxy endpoint `/api/strava/token` to keep the client secret secure.
 */
export async function exchangeToken(code: string, returnedState?: string | null): Promise<TokenResponse> {
  const savedState = sessionStorage.getItem('strava_oauth_state');
  if (savedState && returnedState && savedState !== returnedState) {
    console.error('OAuth state mismatch! Potential CSRF attack.');
    throw new Error('OAuth state verification failed. Please try logging in again.');
  }

  // 1. Try serverless / Vite dev proxy endpoint
  try {
    const proxyRes = await fetch('/api/strava/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code
      })
    });

    if (proxyRes.ok) {
      return proxyRes.json();
    }
  } catch (proxyErr) {
    console.warn('/api/strava/token proxy call failed, attempting fallback...', proxyErr);
  }

  // 2. Direct fallback (for dev preview when backend serverless is not yet active)
  if (CLIENT_SECRET) {
    console.warn('Using client-side token exchange fallback. In production, configure serverless token endpoint.');
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to exchange token directly: ${errText}`);
    }

    return response.json();
  }

  throw new Error('Could not exchange token. Ensure the serverless token endpoint or credentials are configured.');
}

/**
 * Refresh an expired access token.
 */
export async function refreshStravaToken(refreshToken: string): Promise<TokenResponse> {
  try {
    const proxyRes = await fetch('/api/strava/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (proxyRes.ok) {
      return proxyRes.json();
    }
  } catch (proxyErr) {
    console.warn('/api/strava/token refresh call failed, attempting fallback...', proxyErr);
  }

  if (CLIENT_SECRET) {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token via fallback');
    }

    return response.json();
  }

  throw new Error('Failed to refresh Strava token');
}

/**
 * Fetch authenticated athlete profile from Strava.
 */
export async function getAthlete(accessToken: string): Promise<Record<string, unknown>> {
  const res = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch athlete profile: HTTP ${res.status}`);
  }
  return res.json();
}

export interface SyncOptions {
  lookbackDays?: number;
  forceFull?: boolean;
  onProgress?: (status: string) => void;
}

export interface SyncResult {
  importedCount: number;
  totalInDb: number;
  lastSyncTime: number;
}

/**
 * Tier 1: Strict Rate-Limit Safe Bulk Sync.
 * Fetches the last 90 days of cycling activities using paginated requests (100 per page).
 * Stays well within Strava's 100 req / 15 min limit by fetching summaries only.
 */
export async function syncActivities(accessToken: string, options: SyncOptions = {}): Promise<SyncResult> {
  const { lookbackDays = 90, forceFull = false, onProgress } = options;

  onProgress?.('Bezig met controleren van eerdere synchronisatie...');
  const lastSync = await getLastSyncTime();

  // If forceFull or no lastSync, look back 90 days.
  // Otherwise, look back to lastSync minus a 1-day safety margin.
  const ninetyDaysAgoSec = Math.floor((Date.now() - lookbackDays * 86400 * 1000) / 1000);
  let afterEpochSec = ninetyDaysAgoSec;

  if (!forceFull && lastSync > 0) {
    const lastSyncSec = Math.floor(lastSync / 1000) - 86400; // 1 day overlap buffer
    afterEpochSec = Math.max(ninetyDaysAgoSec, lastSyncSec);
  }

  let page = 1;
  const allFetched: Record<string, unknown>[] = [];
  const maxPages = 5; // Safety limit (5 * 100 = 500 rides in 90 days, well above typical usage)

  while (page <= maxPages) {
    onProgress?.(`Ritten ophalen van Strava (pagina ${page})...`);
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${afterEpochSec}&per_page=100&page=${page}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.status === 429) {
      throw new Error('Strava API rate limit bereikt (100 req/15 min). Wacht even en probeer opnieuw.');
    }

    if (!res.ok) {
      throw new Error(`Strava API fout tijdens ophalen van activiteiten: HTTP ${res.status}`);
    }

    const activities = await res.json();
    if (!Array.isArray(activities) || activities.length === 0) {
      break;
    }

    allFetched.push(...activities);

    // If less than 100 items returned, we have reached the end of results
    if (activities.length < 100) {
      break;
    }

    page++;
  }

  onProgress?.(`${allFetched.length} ritten normaliseren en opslaan in lokale IndexedDB...`);
  const result = await upsertActivities(allFetched);
  const now = Date.now();
  await setLastSyncTime(now);

  onProgress?.(`Synchronisatie voltooid: ${result.importedCount} ritten bijgewerkt.`);

  return {
    importedCount: result.importedCount,
    totalInDb: result.totalCount,
    lastSyncTime: now
  };
}

// Backward-compatible alias for existing callers
export async function getActivities(accessToken: string, after?: number): Promise<Record<string, unknown>[]> {
  const url = `https://www.strava.com/api/v3/athlete/activities?per_page=100${after ? `&after=${after}` : ''}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  return res.json();
}

/**
 * Tier 2: Lazy Stream Fetcher (On-Demand).
 * Fetches second-by-second telemetry (watts, heartrate, cadence, distance, altitude, time)
 * only when a specific ride is inspected. Checks local Dexie cache first!
 */
export async function fetchActivityStreams(
  activityId: number,
  accessToken: string
): Promise<ActivityStreamRecord | null> {
  // 1. Check local IndexedDB cache first
  const cached = await getActivityStream(activityId);
  if (cached) {
    return cached;
  }

  // 2. Fetch on-demand from Strava
  const url = `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=time,watts,heartrate,cadence,distance,altitude&key_by_type=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (res.status === 404) {
    return null;
  }

  if (res.status === 429) {
    throw new Error('Strava API rate limit bereikt. Probeer streams later opnieuw op te halen.');
  }

  if (!res.ok) {
    throw new Error(`Fout bij ophalen van streams voor activiteit ${activityId}: HTTP ${res.status}`);
  }

  const streamData = await res.json();
  const streamRecord: ActivityStreamRecord = {
    activity_id: activityId,
    time: streamData.time?.data || [],
    watts: streamData.watts?.data || null,
    heartrate: streamData.heartrate?.data || null,
    cadence: streamData.cadence?.data || null,
    distance: streamData.distance?.data || null,
    altitude: streamData.altitude?.data || null,
    fetched_at: Date.now()
  };

  await saveActivityStream(streamRecord);
  return streamRecord;
}
