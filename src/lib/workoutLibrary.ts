/**
 * Structured Workout Library & Step Generator for Watts Next
 * Purely deterministic, fully typed TypeScript models.
 */

export type WorkoutCategory =
  | 'recovery'
  | 'endurance'
  | 'tempo'
  | 'sweetspot'
  | 'threshold'
  | 'vo2max'
  | 'anaerobic'
  | 'rest';

export type WorkoutStepType =
  | 'warmup'
  | 'steadystate'
  | 'interval'
  | 'recovery_interval'
  | 'cooldown';

export interface WorkoutStep {
  id: string;
  name: string;
  type: WorkoutStepType;
  durationSeconds: number;
  targetFtpPercent: number; // e.g. 0.90 = 90% FTP
  targetFtpPercentHigh?: number; // optional upper bound e.g. 0.92
  targetCadence?: number; // RPM
  description?: string;
}

export interface StructuredWorkout {
  id: string;
  category: WorkoutCategory;
  title: string;
  shortTitle: string;
  description: string;
  durationMinutes: number;
  intensityFactor: number;
  estimatedTss: number;
  targetZone: string; // e.g. 'Z2', 'Z4', 'Z5'
  preference: 'indoor' | 'outdoor' | 'both';
  steps: WorkoutStep[];
}

export interface ComputedWorkoutStep extends WorkoutStep {
  targetWattsLow: number;
  targetWattsHigh: number;
  formattedDuration: string;
}

export interface ComputedWorkout extends StructuredWorkout {
  computedSteps: ComputedWorkoutStep[];
  calculatedWattsSummary: string;
  totalDurationFormatted: string;
}

/**
 * Format seconds into mm:ss or hh:mm:ss
 */
export function formatStepDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (seconds >= 3600) {
    const hrs = Math.floor(seconds / 3600);
    const remMins = Math.floor((seconds % 3600) / 60);
    return `${hrs}u ${remMins.toString().padStart(2, '0')}m`;
  }
  if (secs === 0) {
    return `${mins} min`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate target watts from FTP and step intensity
 */
export function computeStepWatts(step: WorkoutStep, ftp: number): { low: number; high: number } {
  const low = Math.round(ftp * step.targetFtpPercent);
  const high = step.targetFtpPercentHigh 
    ? Math.round(ftp * step.targetFtpPercentHigh) 
    : low;
  return { low, high };
}

/**
 * Base Workout Templates
 */
export const WORKOUT_TEMPLATES: Record<string, StructuredWorkout> = {
  // 1. Rest Day
  rest: {
    id: 'rest',
    category: 'rest',
    title: 'Volledige Hersteldag',
    shortTitle: 'Rustdag',
    description: 'Volledige rust om spierweefsel te herstellen en glycogeenvoorraden aan te vullen.',
    durationMinutes: 0,
    intensityFactor: 0,
    estimatedTss: 0,
    targetZone: 'Rust',
    preference: 'both',
    steps: []
  },

  // 2. Recovery / Koffierit
  recovery_spin: {
    id: 'recovery_spin',
    category: 'recovery',
    title: 'Actief Herstel / Losrijden',
    shortTitle: 'Herstelrit',
    description: 'Heel rustig peddelen met hoge cadans (<55% FTP) ter bevordering van de bloedsomloop.',
    durationMinutes: 45,
    intensityFactor: 0.50,
    estimatedTss: 19,
    targetZone: 'Z1',
    preference: 'both',
    steps: [
      { id: 'wu', name: 'Opwarmen', type: 'warmup', durationSeconds: 600, targetFtpPercent: 0.45, targetFtpPercentHigh: 0.50, targetCadence: 90, description: 'Soepel draaien' },
      { id: 'rec', name: 'Actief herstel', type: 'steadystate', durationSeconds: 1500, targetFtpPercent: 0.50, targetFtpPercentHigh: 0.55, targetCadence: 95, description: 'Blijf ruim onder je ademhalingsdrempel' },
      { id: 'cd', name: 'Uitfietsen', type: 'cooldown', durationSeconds: 600, targetFtpPercent: 0.40, targetFtpPercentHigh: 0.45, targetCadence: 90, description: 'Benen losgooien' }
    ]
  },

  // 3. Endurance Zone 2 Base (60 min)
  endurance_60: {
    id: 'endurance_60',
    category: 'endurance',
    title: 'Aerobe Basis Duurtraining (60 min)',
    shortTitle: 'Zone 2 Duur (60m)',
    description: 'Constante aerobe prikkel in Zone 2 om vetverbranding en capillaire dichtheid te stimuleren.',
    durationMinutes: 60,
    intensityFactor: 0.68,
    estimatedTss: 46,
    targetZone: 'Z2',
    preference: 'both',
    steps: [
      { id: 'wu', name: 'Opwarmen', type: 'warmup', durationSeconds: 600, targetFtpPercent: 0.55, targetFtpPercentHigh: 0.60, targetCadence: 90 },
      { id: 'z2', name: 'Zone 2 Duurblok', type: 'steadystate', durationSeconds: 2700, targetFtpPercent: 0.65, targetFtpPercentHigh: 0.72, targetCadence: 90, description: 'Stabiele aerobe druk op de pedalen' },
      { id: 'cd', name: 'Cool-down', type: 'cooldown', durationSeconds: 300, targetFtpPercent: 0.50, targetCadence: 85 }
    ]
  },

  // 4. Endurance Zone 2 Long Ride (90 min)
  endurance_90: {
    id: 'endurance_90',
    category: 'endurance',
    title: 'Zone 2 Duurrit (90 min)',
    shortTitle: 'Zone 2 Duur (90m)',
    description: 'Sustained Zone 2 endurance rit om mitochondriën te bouwen.',
    durationMinutes: 90,
    intensityFactor: 0.68,
    estimatedTss: 70,
    targetZone: 'Z2',
    preference: 'both',
    steps: [
      { id: 'wu', name: 'Opwarmen', type: 'warmup', durationSeconds: 600, targetFtpPercent: 0.55, targetFtpPercentHigh: 0.60, targetCadence: 90 },
      { id: 'z2', name: 'Zone 2 Basisrit', type: 'steadystate', durationSeconds: 4500, targetFtpPercent: 0.65, targetFtpPercentHigh: 0.72, targetCadence: 90, description: 'Praten in volzinnen moet gemakkelijk gaan' },
      { id: 'cd', name: 'Cool-down', type: 'cooldown', durationSeconds: 300, targetFtpPercent: 0.50, targetCadence: 85 }
    ]
  },

  // 5. Endurance Zone 2 Weekend Long Ride (150-180 min)
  endurance_long: {
    id: 'endurance_long',
    category: 'endurance',
    title: 'Lange Duurrit (Weekend)',
    shortTitle: 'Lange Duurrit',
    description: 'Omvangrijke aerobe trainingsprikkel voor het bouwen van pure uithouding en vetmetabolisme.',
    durationMinutes: 180,
    intensityFactor: 0.67,
    estimatedTss: 135,
    targetZone: 'Z2',
    preference: 'outdoor',
    steps: [
      { id: 'wu', name: 'Opwarmen', type: 'warmup', durationSeconds: 900, targetFtpPercent: 0.55, targetFtpPercentHigh: 0.60, targetCadence: 90 },
      { id: 'z2', name: 'Lange aerobe afstand', type: 'steadystate', durationSeconds: 9300, targetFtpPercent: 0.65, targetFtpPercentHigh: 0.73, targetCadence: 90, description: 'Focus op gelijkmatig tempo en tijdig eten/drinken' },
      { id: 'cd', name: 'Cool-down', type: 'cooldown', durationSeconds: 600, targetFtpPercent: 0.50, targetCadence: 85 }
    ]
  },

  // 6. VO2 Max: 40/20 Micro-bursts (60 min)
  vo2max_40_20: {
    id: 'vo2max_40_20',
    category: 'vo2max',
    title: 'VO₂ Max 40/20 Intervallen',
    shortTitle: 'VO₂ Max 40/20',
    description: '2 sets van 8× [40s @ 120% FTP / 20s herstel]. Maximale zuurstofopname zonder zware lactaatophoping.',
    durationMinutes: 60,
    intensityFactor: 0.86,
    estimatedTss: 74,
    targetZone: 'Z5',
    preference: 'indoor',
    steps: [
      { id: 'wu1', name: 'Progressieve Warm-up', type: 'warmup', durationSeconds: 600, targetFtpPercent: 0.55, targetFtpPercentHigh: 0.75, targetCadence: 90, description: 'Opwarmen met versnellingen' },
      { id: 'openers', name: '2x 30s Activatie', type: 'interval', durationSeconds: 180, targetFtpPercent: 0.95, targetCadence: 100, description: 'Korte activatieprikkel voor de intervallen' },
      { id: 'set1', name: 'Set 1: 8x (40s @ 120% / 20s @ 50%)', type: 'interval', durationSeconds: 480, targetFtpPercent: 1.20, targetFtpPercentHigh: 1.25, targetCadence: 105, description: '40s hard trappen, 20s soepel doordraaien' },
      { id: 'set_rec', name: 'Tussenset Herstel', type: 'recovery_interval', durationSeconds: 300, targetFtpPercent: 0.50, targetCadence: 85, description: 'Volledig herstel voor de tweede set' },
      { id: 'set2', name: 'Set 2: 8x (40s @ 120% / 20s @ 50%)', type: 'interval', durationSeconds: 480, targetFtpPercent: 1.20, targetFtpPercentHigh: 1.25, targetCadence: 105, description: 'Handhaaf hoge cadans en vermogen' },
      { id: 'cd', name: 'Cool-down', type: 'cooldown', durationSeconds: 600, targetFtpPercent: 0.50, targetCadence: 90, description: 'Lactaat afvoeren' }
    ]
  },

  // 7. VO2 Max: 5x 3-minuut blokken (60 min)
  vo2max_classic: {
    id: 'vo2max_classic',
    category: 'vo2max',
    title: 'Klassieke VO₂ Max Blokken (5×3 min)',
    shortTitle: 'VO₂ Max 5×3m',
    description: '5 herhalingen van 3 minuten op 115-120% FTP met 3 minuten rust tussen de intervallen.',
    durationMinutes: 60,
    intensityFactor: 0.88,
    estimatedTss: 78,
    targetZone: 'Z5',
    preference: 'both',
    steps: [
      { id: 'wu', name: 'Warm-up', type: 'warmup', durationSeconds: 720, targetFtpPercent: 0.55, targetFtpPercentHigh: 0.75, targetCadence: 90 },
      { id: 'int1', name: 'Intervallen 5x (3 min @ 118% + 3 min rust)', type: 'interval', durationSeconds: 1800, targetFtpPercent: 1.15, targetFtpPercentHigh: 1.20, targetCadence: 100, description: 'Maximaliseer ademhaling en zuurstofopname' },
      { id: 'cd', name: 'Cool-down', type: 'cooldown', durationSeconds: 540, targetFtpPercent: 0.50, targetCadence: 85 }
    ]
  },

  // 8. Sweet Spot: 3x12 min (60-75 min)
  sweetspot_3x12: {
    id: 'sweetspot_3x12',
    category: 'sweetspot',
    title: 'Sweet Spot Blokken (3×12 min)',
    shortTitle: 'Sweet Spot 3×12m',
    description: '3 blokken van 12 minuten op 90% FTP met 4 minuten herstel. De meest efficiënte prikkel om je FTP op te krikken.',
    durationMinutes: 65,
    intensityFactor: 0.84,
    estimatedTss: 76,
    targetZone: 'Sweet Spot',
    preference: 'both',
    steps: [
      { id: 'wu', name: 'Progressieve Warm-up', type: 'warmup', durationSeconds: 600, targetFtpPercent: 0.55, targetFtpPercentHigh: 0.75, targetCadence: 90 },
      { id: 'b1', name: 'Blok 1 (12 min @ 90%)', type: 'interval', durationSeconds: 720, targetFtpPercent: 0.88, targetFtpPercentHigh: 0.92, targetCadence: 92, description: 'Zoek de sweet spot zone (88-92% FTP)' },
      { id: 'r1', name: 'Herstel', type: 'recovery_interval', durationSeconds: 240, targetFtpPercent: 0.55, targetCadence: 85 },
      { id: 'b2', name: 'Blok 2 (12 min @ 90%)', type: 'interval', durationSeconds: 720, targetFtpPercent: 0.88, targetFtpPercentHigh: 0.92, targetCadence: 92 },
      { id: 'r2', name: 'Herstel', type: 'recovery_interval', durationSeconds: 240, targetFtpPercent: 0.55, targetCadence: 85 },
      { id: 'b3', name: 'Blok 3 (12 min @ 90%)', type: 'interval', durationSeconds: 720, targetFtpPercent: 0.88, targetFtpPercentHigh: 0.92, targetCadence: 92 },
      { id: 'cd', name: 'Cool-down', type: 'cooldown', durationSeconds: 660, targetFtpPercent: 0.50, targetCadence: 85 }
    ]
  },

  // 9. Threshold / Drempel: 2x 20 min (60-75 min)
  threshold_2x20: {
    id: 'threshold_2x20',
    category: 'threshold',
    title: 'Drempel Intervallen (2×20 min)',
    shortTitle: 'Drempel 2×20m',
    description: '2 lange blokken van 20 minuten op 98-100% FTP. Maximale lactaattolerantie en mentale hardheid.',
    durationMinutes: 75,
    intensityFactor: 0.89,
    estimatedTss: 98,
    targetZone: 'Z4',
    preference: 'both',
    steps: [
      { id: 'wu', name: 'Warm-up', type: 'warmup', durationSeconds: 600, targetFtpPercent: 0.55, targetFtpPercentHigh: 0.75, targetCadence: 90 },
      { id: 'b1', name: 'Blok 1 (20 min @ 100% FTP)', type: 'interval', durationSeconds: 1200, targetFtpPercent: 0.98, targetFtpPercentHigh: 1.02, targetCadence: 92, description: 'Rijd precies op je FTP-drempel' },
      { id: 'r1', name: 'Herstel', type: 'recovery_interval', durationSeconds: 480, targetFtpPercent: 0.55, targetCadence: 85 },
      { id: 'b2', name: 'Blok 2 (20 min @ 100% FTP)', type: 'interval', durationSeconds: 1200, targetFtpPercent: 0.98, targetFtpPercentHigh: 1.02, targetCadence: 92, description: 'Vasthouden en focussen op gelijkmatige ademhaling' },
      { id: 'cd', name: 'Cool-down', type: 'cooldown', durationSeconds: 520, targetFtpPercent: 0.50, targetCadence: 85 }
    ]
  },

  // 10. Tempo met Cadanswissels (75-90 min)
  tempo_cadence: {
    id: 'tempo_cadence',
    category: 'tempo',
    title: 'Tempo Rit met Cadanswissels',
    shortTitle: 'Tempo Z3 (75m)',
    description: 'Zone 3 tempo-inspanning (76-85% FTP) met intervallen op 75 en 100 RPM voor neuromusculaire efficiëntie.',
    durationMinutes: 75,
    intensityFactor: 0.78,
    estimatedTss: 75,
    targetZone: 'Z3',
    preference: 'both',
    steps: [
      { id: 'wu', name: 'Warm-up', type: 'warmup', durationSeconds: 600, targetFtpPercent: 0.55, targetFtpPercentHigh: 0.70, targetCadence: 90 },
      { id: 'b1', name: 'Tempo Blok 1', type: 'steadystate', durationSeconds: 1200, targetFtpPercent: 0.80, targetFtpPercentHigh: 0.85, targetCadence: 95 },
      { id: 'r1', name: 'Herstel', type: 'recovery_interval', durationSeconds: 300, targetFtpPercent: 0.55, targetCadence: 85 },
      { id: 'b2', name: 'Tempo Blok 2', type: 'steadystate', durationSeconds: 1200, targetFtpPercent: 0.80, targetFtpPercentHigh: 0.85, targetCadence: 80 },
      { id: 'cd', name: 'Cool-down', type: 'cooldown', durationSeconds: 600, targetFtpPercent: 0.50, targetCadence: 90 }
    ]
  }
};

/**
 * Dynamic Scaling Engine:
 * Adjusts warmup, cooldown, or steady-state duration to match the athlete's exact available minutes.
 */
export function scaleWorkoutToMinutes(
  template: StructuredWorkout,
  targetMinutes: number,
  ftp: number
): ComputedWorkout {
  if (targetMinutes <= 0 || template.category === 'rest') {
    return {
      ...WORKOUT_TEMPLATES.rest,
      durationMinutes: 0,
      computedSteps: [],
      calculatedWattsSummary: 'Rust / Geen belasting',
      totalDurationFormatted: 'Rustdag'
    };
  }

  const targetSeconds = targetMinutes * 60;
  const originalTotalSeconds = template.steps.reduce((sum, s) => sum + s.durationSeconds, 0);

  let scaledSteps: WorkoutStep[] = [];

  if (originalTotalSeconds === 0) {
    // If empty steps, generate a solid Zone 2 endurance structure
    scaledSteps = [
      { id: 'wu', name: 'Opwarmen', type: 'warmup', durationSeconds: Math.min(600, targetSeconds * 0.15), targetFtpPercent: 0.55, targetFtpPercentHigh: 0.60, targetCadence: 90 },
      { id: 'main', name: `${template.shortTitle} Blok`, type: 'steadystate', durationSeconds: targetSeconds - Math.min(600, targetSeconds * 0.15) - Math.min(300, targetSeconds * 0.10), targetFtpPercent: 0.68, targetCadence: 90 },
      { id: 'cd', name: 'Cool-down', type: 'cooldown', durationSeconds: Math.min(300, targetSeconds * 0.10), targetFtpPercent: 0.50, targetCadence: 85 }
    ];
  } else {
    // We adjust non-interval steps (warmup/cooldown/steadystate) to absorb duration differences,
    // protecting the key interval blocks.
    const intervalSeconds = template.steps
      .filter(s => s.type === 'interval' || s.type === 'recovery_interval')
      .reduce((sum, s) => sum + s.durationSeconds, 0);

    const nonIntervalSteps = template.steps.filter(
      s => s.type !== 'interval' && s.type !== 'recovery_interval'
    );
    const nonIntervalSeconds = nonIntervalSteps.reduce((sum, s) => sum + s.durationSeconds, 0);

    // If target is too short for all intervals, scale proportionally
    if (targetSeconds < intervalSeconds + 300) {
      const scale = targetSeconds / originalTotalSeconds;
      scaledSteps = template.steps.map(s => ({
        ...s,
        durationSeconds: Math.max(20, Math.round(s.durationSeconds * scale))
      }));
    } else {
      // Keep intervals intact, adjust warmup and cooldown to meet target time
      const remainingForNonIntervals = targetSeconds - intervalSeconds;
      const nonIntervalScale = nonIntervalSeconds > 0 ? remainingForNonIntervals / nonIntervalSeconds : 1;

      scaledSteps = template.steps.map(s => {
        if (s.type === 'interval' || s.type === 'recovery_interval') {
          return { ...s };
        }
        return {
          ...s,
          durationSeconds: Math.max(60, Math.round(s.durationSeconds * nonIntervalScale))
        };
      });
    }
  }

  // Ensure total seconds exactly matches target
  const currentTotal = scaledSteps.reduce((sum, s) => sum + s.durationSeconds, 0);
  const diff = targetSeconds - currentTotal;
  if (scaledSteps.length > 0 && Math.abs(diff) > 0) {
    // Add or subtract diff from the largest steady or cooldown step
    const targetStep = scaledSteps.find(s => s.type === 'steadystate') || scaledSteps[scaledSteps.length - 1];
    targetStep.durationSeconds = Math.max(30, targetStep.durationSeconds + diff);
  }

  // Compute exact watts for each step
  const computedSteps: ComputedWorkoutStep[] = scaledSteps.map(step => {
    const { low, high } = computeStepWatts(step, ftp);
    return {
      ...step,
      targetWattsLow: low,
      targetWattsHigh: high,
      formattedDuration: formatStepDuration(step.durationSeconds)
    };
  });

  // Calculate scaled TSS
  const scaledTss = Math.round((targetMinutes / Math.max(1, template.durationMinutes || targetMinutes)) * template.estimatedTss);

  // Watts summary text
  const intervalStep = computedSteps.find(s => s.type === 'interval') || computedSteps.find(s => s.type === 'steadystate') || computedSteps[0];
  let calculatedWattsSummary = '';
  if (intervalStep) {
    calculatedWattsSummary = intervalStep.targetWattsHigh > intervalStep.targetWattsLow
      ? `${intervalStep.targetWattsLow}-${intervalStep.targetWattsHigh}W`
      : `${intervalStep.targetWattsLow}W`;
  }

  return {
    ...template,
    durationMinutes: targetMinutes,
    estimatedTss: Math.max(5, scaledTss),
    computedSteps,
    calculatedWattsSummary,
    totalDurationFormatted: `${targetMinutes} min`
  };
}
