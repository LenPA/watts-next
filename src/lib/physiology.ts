/**
 * Watts Next - Physiological Analysis Engine
 * 
 * Pure TypeScript implementation of:
 * - Coggan 7-Zone Power Model + Sweet Spot
 * - Heart Rate Zones
 * - Normalized Power (NP - 30s rolling average, 4th power)
 * - Intensity Factor (IF)
 * - Training Stress Score (TSS) with transparent data provenance
 * - EWMA Fitness Trends (ATL 7-day, CTL 42-day, TSB form balance)
 * 
 * Zero UI dependencies, 100% deterministic and testable.
 */

import type { NormalizedActivity, ActivityStreamRecord } from './db';

export type LoadProvenance =
  | 'measured_stream'        // Exact NP from second-by-second power stream
  | 'calculated_weighted'   // Strava weighted_average_watts used as NP proxy
  | 'estimated_heartrate'    // hrTSS based on heart rate vs Max HR/LTHR
  | 'estimated_suffer_score' // Strava suffer_score / relative effort
  | 'estimated_time'         // Moving time fallback (40 TSS/hr)
  | 'none';                  // 0 load (non-cycling or no data)

export interface PowerZone {
  code: string;
  name: string;
  rangeName: string;
  minWatts: number;
  maxWatts: number;
  minPct: number;
  maxPct: number;
  description: string;
  colorToken: string;
}

export interface ZoneDistribution {
  zoneCode: string;
  zoneName: string;
  colorToken: string;
  seconds: number;
  percentage: number;
}

export interface ActivityPhysiology {
  load: number; // TSS equivalent (rounded to 1 decimal place)
  np: number | null; // Normalized Power in Watts
  if: number | null; // Intensity Factor
  provenance: LoadProvenance;
  provenanceLabel: string;
  provenanceDescription: string;
  isEstimated: boolean;
  zoneDistribution?: ZoneDistribution[];
}

export interface DailyFitnessRecord {
  date: string; // YYYY-MM-DD
  dateLabel: string; // "14 okt"
  timestamp: number;
  ctl: number; // Chronic Training Load (42-day fitness)
  atl: number; // Acute Training Load (7-day fatigue)
  tsb: number; // Training Stress Balance (form: CTL_yesterday - ATL_yesterday)
  dailyTss: number;
  activityCount: number;
}

export interface FitnessSummary {
  currentCtl: number;
  currentAtl: number;
  currentTsb: number;
  formStatus: 'fresh' | 'optimal' | 'neutral' | 'overreached' | 'fatigued';
  formStatusLabel: string;
  formStatusDescription: string;
  series: DailyFitnessRecord[];
}

// ---------------------------------------------------------------------------
// 1. Coggan 7 Power Zones + Sweet Spot
// ---------------------------------------------------------------------------

export function calculatePowerZones(ftp: number): PowerZone[] {
  const safeFtp = Math.max(50, Math.round(ftp));

  return [
    {
      code: 'Z1',
      name: 'Actief Herstel',
      rangeName: '< 55% FTP',
      minWatts: 0,
      maxWatts: Math.round(safeFtp * 0.55),
      minPct: 0,
      maxPct: 55,
      description: 'Zeer lichte belasting, bevordert herstel en doorbloeding.',
      colorToken: 'var(--color-zone-recovery)'
    },
    {
      code: 'Z2',
      name: 'Duurtraining (Endurance)',
      rangeName: '55% - 75% FTP',
      minWatts: Math.round(safeFtp * 0.55) + 1,
      maxWatts: Math.round(safeFtp * 0.75),
      minPct: 55,
      maxPct: 75,
      description: 'Fundament voor vetverbranding en mitochondriale opbouw.',
      colorToken: 'var(--color-zone-endurance)'
    },
    {
      code: 'Z3',
      name: 'Tempo',
      rangeName: '76% - 90% FTP',
      minWatts: Math.round(safeFtp * 0.76),
      maxWatts: Math.round(safeFtp * 0.90),
      minPct: 76,
      maxPct: 90,
      description: 'Stevig aerobe tempo, vereist meer koolhydraatverbranding.',
      colorToken: 'var(--color-zone-tempo)'
    },
    {
      code: 'SS',
      name: 'Sweet Spot',
      rangeName: '88% - 93% FTP',
      minWatts: Math.round(safeFtp * 0.88),
      maxWatts: Math.round(safeFtp * 0.93),
      minPct: 88,
      maxPct: 93,
      description: 'Optimale balans tussen aerobe prikkel en hersteltijd.',
      colorToken: 'var(--color-zone-sweetspot)'
    },
    {
      code: 'Z4',
      name: 'Drempel (Threshold)',
      rangeName: '91% - 105% FTP',
      minWatts: Math.round(safeFtp * 0.91),
      maxWatts: Math.round(safeFtp * 1.05),
      minPct: 91,
      maxPct: 105,
      description: 'Lactaatdrempel: verhoogt het duurvermogen dat je 40-60 min volhoudt.',
      colorToken: 'var(--color-zone-threshold)'
    },
    {
      code: 'Z5',
      name: 'VO2 Max',
      rangeName: '106% - 120% FTP',
      minWatts: Math.round(safeFtp * 1.06),
      maxWatts: Math.round(safeFtp * 1.20),
      minPct: 106,
      maxPct: 120,
      description: 'Intervallen van 3-8 minuten voor maximaal zuurstofopnamevermogen.',
      colorToken: 'var(--color-zone-vo2max)'
    },
    {
      code: 'Z6',
      name: 'Anaerobe Capaciteit',
      rangeName: '121% - 150% FTP',
      minWatts: Math.round(safeFtp * 1.21),
      maxWatts: Math.round(safeFtp * 1.50),
      minPct: 121,
      maxPct: 150,
      description: 'Korte harde inspanningen van 30 seconden tot 2 minuten.',
      colorToken: '#dc2626'
    },
    {
      code: 'Z7',
      name: 'Neuromusculair (Sprint)',
      rangeName: '> 150% FTP',
      minWatts: Math.round(safeFtp * 1.50) + 1,
      maxWatts: 9999,
      minPct: 150,
      maxPct: 500,
      description: 'Maximale sprints van enkele seconden, pure spierkracht.',
      colorToken: '#9333ea'
    }
  ];
}

/**
 * Calculate seconds and percentage in each Coggan zone from a second-by-second power stream.
 */
export function calculateZoneDistribution(watts: number[], ftp: number): ZoneDistribution[] {
  if (!watts || watts.length === 0) return [];
  const safeFtp = Math.max(50, ftp);
  const zones = calculatePowerZones(safeFtp).filter(z => z.code !== 'SS'); // Standard non-overlapping Z1-Z7
  
  const counts: Record<string, number> = {};
  zones.forEach(z => { counts[z.code] = 0; });

  for (let i = 0; i < watts.length; i++) {
    const w = watts[i] || 0;
    const pct = (w / safeFtp) * 100;

    if (pct <= 55) counts['Z1']++;
    else if (pct <= 75) counts['Z2']++;
    else if (pct <= 90) counts['Z3']++;
    else if (pct <= 105) counts['Z4']++;
    else if (pct <= 120) counts['Z5']++;
    else if (pct <= 150) counts['Z6']++;
    else counts['Z7']++;
  }

  const total = watts.length;
  return zones.map(z => ({
    zoneCode: z.code,
    zoneName: z.name,
    colorToken: z.colorToken,
    seconds: counts[z.code] || 0,
    percentage: Math.round(((counts[z.code] || 0) / total) * 1000) / 10
  }));
}

// ---------------------------------------------------------------------------
// 2. Normalized Power (NP), Intensity Factor (IF) & Coggan TSS
// ---------------------------------------------------------------------------

/**
 * Calculates Normalized Power (NP) using Dr. Andrew Coggan's 4th power rolling algorithm:
 * 1. 30-second moving average of power stream.
 * 2. Raise values to the 4th power.
 * 3. Average the 4th powers.
 * 4. Take the 4th root.
 */
export function calculateNormalizedPower(watts: number[]): number | null {
  if (!watts || watts.length === 0) return null;

  // Filter out negative values if any
  const cleaned = watts.map(w => (typeof w === 'number' && !isNaN(w) && w > 0 ? w : 0));
  const n = cleaned.length;

  if (n < 30) {
    // If shorter than 30s, return average power
    const sum = cleaned.reduce((a, b) => a + b, 0);
    return Math.round(sum / n);
  }

  // Calculate 30-second moving average
  let rollingSum = 0;
  for (let i = 0; i < 30; i++) {
    rollingSum += cleaned[i];
  }

  let sumFourthPowers = 0;
  let count = 0;

  // First 30s window average
  let movingAvg = rollingSum / 30;
  sumFourthPowers += Math.pow(movingAvg, 4);
  count++;

  for (let i = 30; i < n; i++) {
    rollingSum += cleaned[i] - cleaned[i - 30];
    movingAvg = rollingSum / 30;
    sumFourthPowers += Math.pow(movingAvg, 4);
    count++;
  }

  if (count === 0) return null;

  const meanFourth = sumFourthPowers / count;
  const np = Math.pow(meanFourth, 0.25);

  return Math.round(np);
}

/**
 * Calculate Intensity Factor (IF = NP / FTP)
 */
export function calculateIntensityFactor(np: number, ftp: number): number {
  if (!ftp || ftp <= 0 || !np || np <= 0) return 0;
  return Math.round((np / ftp) * 100) / 100;
}

/**
 * Calculate Coggan Training Stress Score (TSS)
 * TSS = (sec * NP * IF) / (FTP * 3600) * 100
 */
export function calculateCogganTss(durationSeconds: number, np: number, ftp: number): number {
  if (!ftp || ftp <= 0 || !np || np <= 0 || !durationSeconds || durationSeconds <= 0) return 0;
  const ifactor = np / ftp;
  const tss = (durationSeconds * np * ifactor) / (ftp * 3600) * 100;
  return Math.round(tss * 10) / 10;
}

// ---------------------------------------------------------------------------
// 3. Fallback Hierarchy & Data Provenance
// ---------------------------------------------------------------------------

/**
 * Deterministically analyzes an activity with explicit provenance tracking.
 * Never invents fake power data.
 * 
 * Hierarchy:
 * 1. Stream present: Exact Coggan NP, IF, TSS from 30s rolling avg (measured_stream)
 * 2. Strava weighted_average_watts: Uses weighted watts as NP proxy (calculated_weighted)
 * 3. Heartrate present: hrTSS / TRIMP proxy (estimated_heartrate)
 * 4. Suffer score: Strava Relative Effort proxy (estimated_suffer_score)
 * 5. Time only: Moving duration * 40 TSS/hr (estimated_time)
 */
export function calculateActivityPhysiology(
  activity: NormalizedActivity,
  ftp: number,
  stream?: ActivityStreamRecord | null,
  athleteMaxHr: number = 190
): ActivityPhysiology {
  const duration = activity.moving_time || activity.elapsed_time || 0;
  const safeFtp = Math.max(50, Math.round(ftp));

  // Case 0: Zero duration or non-cycling
  if (duration <= 0) {
    return {
      load: 0,
      np: null,
      if: null,
      provenance: 'none',
      provenanceLabel: 'Geen data',
      provenanceDescription: 'Rit heeft geen tijdsduur geregistreerd.',
      isEstimated: false
    };
  }

  // Tier 1: Measured second-by-second telemetry stream
  if (stream?.watts && stream.watts.length > 0) {
    const hasActivePower = stream.watts.some(w => w > 0);
    if (hasActivePower) {
      const np = calculateNormalizedPower(stream.watts);
      if (np && np > 0) {
        const ifactor = calculateIntensityFactor(np, safeFtp);
        const tss = calculateCogganTss(duration, np, safeFtp);
        const zoneDist = calculateZoneDistribution(stream.watts, safeFtp);

        return {
          load: tss,
          np,
          if: ifactor,
          provenance: 'measured_stream',
          provenanceLabel: 'Gemeten (Seconde stream)',
          provenanceDescription: 'Echte Normalized Power (30s rollend gem.) en Coggan TSS berekend uit seconde-data.',
          isEstimated: false,
          zoneDistribution: zoneDist
        };
      }
    }
  }

  // Tier 2: Summary Weighted Average Watts (Strava's NP approximation)
  if (activity.weighted_average_watts && activity.weighted_average_watts > 0) {
    const np = Math.round(activity.weighted_average_watts);
    const ifactor = calculateIntensityFactor(np, safeFtp);
    const tss = calculateCogganTss(duration, np, safeFtp);

    return {
      load: tss,
      np,
      if: ifactor,
      provenance: 'calculated_weighted',
      provenanceLabel: 'Berekend (Strava Weighted Watts)',
      provenanceDescription: 'Gebaseerd op Strava’s gewogen vermogen als proxy voor Normalized Power.',
      isEstimated: false
    };
  }

  // Tier 3: Heart Rate without power meter (hrTSS estimation)
  if (activity.has_heartrate && activity.average_heartrate && activity.average_heartrate > 0) {
    const maxHr = activity.max_heartrate || athleteMaxHr;
    // Lactate Threshold Heart Rate (LTHR) is typically ~85-88% of Max HR
    const estimatedLthr = maxHr * 0.86;
    const hrIntensity = Math.min(1.4, Math.max(0.4, activity.average_heartrate / estimatedLthr));
    
    // hrTSS approximation: duration (hours) * (hrIntensity^2) * 100 * efficiency factor
    const hours = duration / 3600;
    const hrTss = Math.round(hours * Math.pow(hrIntensity, 2) * 100 * 0.9 * 10) / 10;

    return {
      load: hrTss,
      np: null,
      if: Math.round(hrIntensity * 100) / 100,
      provenance: 'estimated_heartrate',
      provenanceLabel: 'Geschat via hartslag (hrTSS)',
      provenanceDescription: 'Geen vermogensmeter beschikbaar; belasting geschat via gemiddelde hartslag en LTHR.',
      isEstimated: true
    };
  }

  // Tier 4: Strava Suffer Score / Relative Effort
  if (activity.suffer_score && activity.suffer_score > 0) {
    // Suffer score scales reasonably with TSS for endurance rides
    const load = Math.round(activity.suffer_score * 10) / 10;
    return {
      load,
      np: null,
      if: null,
      provenance: 'estimated_suffer_score',
      provenanceLabel: 'Geschat via Suffer Score',
      provenanceDescription: 'Geen vermogens- of hartslagmeter; belasting geschat via Strava Relative Effort.',
      isEstimated: true
    };
  }

  // Tier 5: Duration only fallback (40 TSS per hour for easy endurance)
  const movingHours = duration / 3600;
  const timeLoad = Math.round(movingHours * 40 * 10) / 10;

  return {
    load: timeLoad,
    np: null,
    if: null,
    provenance: 'estimated_time',
    provenanceLabel: 'Geschat op basis van fietstijd',
    provenanceDescription: 'Geen sensorgegevens beschikbaar; geschat op 40 TSS/uur voor een matige duurrit.',
    isEstimated: true
  };
}

// ---------------------------------------------------------------------------
// 4. EWMA Fitness Trends (ATL, CTL, TSB)
// ---------------------------------------------------------------------------

/**
 * Calculates Chronic Training Load (CTL), Acute Training Load (ATL), and
 * Training Stress Balance (TSB) over a multi-day timeline.
 * 
 * Mathematical parameters:
 * - ATL time constant: 7 days (alpha = 1 - e^(-1/7) ≈ 0.1331)
 * - CTL time constant: 42 days (alpha = 1 - e^(-1/42) ≈ 0.0235)
 * - TSB_today = CTL_yesterday - ATL_yesterday
 * 
 * Note: TSB represents training balance and freshness, not a clinical recovery test.
 */
/**
 * Format a Date object into a local YYYY-MM-DD string without UTC offset shifts.
 */
export function formatLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateFitnessTrends(
  activities: NormalizedActivity[],
  ftp: number,
  options?: {
    days?: number; // default 90 days
    streamsMap?: Map<number, ActivityStreamRecord>;
    athleteMaxHr?: number;
  }
): FitnessSummary {
  const days = options?.days || 90;
  const streamsMap = options?.streamsMap;
  const maxHr = options?.athleteMaxHr || 190;

  // Build daily timeline from (days - 1) days ago until today
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (days - 1));
  startDate.setHours(0, 0, 0, 0);

  // Map activities into day buckets (key: YYYY-MM-DD)
  const dailyLoads = new Map<string, { totalTss: number; count: number }>();

  activities.forEach(act => {
    const rawDate = act.start_date_local || act.start_date;
    if (!rawDate) return;
    const key = rawDate.slice(0, 10);

    const stream = streamsMap?.get(act.id);
    const phys = calculateActivityPhysiology(act, ftp, stream, maxHr);

    const existing = dailyLoads.get(key) || { totalTss: 0, count: 0 };
    dailyLoads.set(key, {
      totalTss: existing.totalTss + phys.load,
      count: existing.count + 1
    });
  });

  // Time constants
  const alphaATL = 1 - Math.exp(-1 / 7);
  const alphaCTL = 1 - Math.exp(-1 / 42);

  const series: DailyFitnessRecord[] = [];
  let currentAtl = 0;
  let currentCtl = 0;

  // Generate continuous timeline
  const cursor = new Date(startDate);
  const monthNames = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  while (cursor <= today) {
    const key = formatLocalDateKey(cursor);
    const dayData = dailyLoads.get(key) || { totalTss: 0, count: 0 };
    const dailyTss = Math.round(dayData.totalTss * 10) / 10;

    // TSB on morning of this day is based on yesterday's ending values
    const tsb = Math.round((currentCtl - currentAtl) * 10) / 10;

    // Update CTL and ATL with today's training stimulus
    currentAtl = currentAtl + alphaATL * (dailyTss - currentAtl);
    currentCtl = currentCtl + alphaCTL * (dailyTss - currentCtl);

    series.push({
      date: key,
      dateLabel: `${cursor.getDate()} ${monthNames[cursor.getMonth()]}`,
      timestamp: cursor.getTime(),
      ctl: Math.round(currentCtl * 10) / 10,
      atl: Math.round(currentAtl * 10) / 10,
      tsb,
      dailyTss,
      activityCount: dayData.count
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  const latest = series[series.length - 1] || { ctl: 0, atl: 0, tsb: 0 };
  const currentTsb = Math.round((currentCtl - currentAtl) * 10) / 10;

  let formStatus: 'fresh' | 'optimal' | 'neutral' | 'overreached' | 'fatigued' = 'neutral';
  let formStatusLabel = 'Neutraal';
  let formStatusDescription = 'Trainingsbelasting en frisheid zijn in evenwicht.';

  if (currentTsb > 20) {
    formStatus = 'fresh';
    formStatusLabel = 'Zeer Fris / Uitgerust';
    formStatusDescription = 'Hoge frisheid. Goed voor een wedstrijd of zware test, maar pas op voor conditieverlies bij te lange inactiviteit.';
  } else if (currentTsb >= 5) {
    formStatus = 'fresh';
    formStatusLabel = 'Topvorm (Peaked)';
    formStatusDescription = 'Ideale wedstrijdbalans: conditie behouden en vermoeidheid grotendeels verdwenen.';
  } else if (currentTsb >= -10) {
    formStatus = 'neutral';
    formStatusLabel = 'Onderhoud / Neutraal';
    formStatusDescription = 'Evenwichtige balans tussen belasting en herstel.';
  } else if (currentTsb >= -30) {
    formStatus = 'optimal';
    formStatusLabel = 'Optimaal Trainingsbereik';
    formStatusDescription = 'Productieve trainingsfase: gecontroleerde opbouw van conditie.';
  } else {
    formStatus = 'overreached';
    formStatusLabel = 'Overbelasting Risico';
    formStatusDescription = 'Zeer hoge acute vermoeidheid. Plan een hersteldag of lichte zone 1 rit in om overtraining te vermijden.';
  }

  return {
    currentCtl: latest.ctl,
    currentAtl: latest.atl,
    currentTsb,
    formStatus,
    formStatusLabel,
    formStatusDescription,
    series
  };
}
