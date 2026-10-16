/**
 * Deterministic Training Plan Generator for Watts Next
 * Purely deterministic, TypeScript rule engine without LLM dependencies.
 * Respects strict user availability, fatigue/freshness (TSB), and target goals.
 */

import type { NormalizedActivity, AthleteProfileRecord, TrainingGoalRecord, AvailabilityRecord } from './db';
import type { DailyFitnessRecord, FitnessSummary } from './physiology';
import { 
  WORKOUT_TEMPLATES, 
  scaleWorkoutToMinutes, 
  type ComputedWorkout, 
  type WorkoutCategory 
} from './workoutLibrary';

export interface PlannedWeekDay {
  date: Date;
  dateKey: string; // YYYY-MM-DD
  dayOfWeek: number; // 0=Monday ... 6=Sunday
  dayName: string; // 'Maandag', etc.
  shortName: string; // 'Ma', etc.
  dayNumber: number;
  monthName: string;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  
  // Availability constraint
  availableMinutes: number;
  preference: 'indoor' | 'outdoor' | 'both' | 'rest';

  // Planned workout
  plannedType: 'Endurance' | 'Threshold' | 'Power' | 'Rest';
  plannedCategory: WorkoutCategory;
  plannedTitle: string;
  plannedDuration: string;
  plannedMinutes: number;
  plannedWatts: string;
  plannedTss: number;
  plannedReason: string;
  reasonCode: string;
  workout: ComputedWorkout;

  // Realized state (Strava activities completed on this day)
  completedActivities: NormalizedActivity[];
  isCompleted: boolean;
  totalActualTss: number;
  totalActualDurationMinutes: number;
}

export interface GeneratePlanOptions {
  profile?: AthleteProfileRecord | null;
  goal?: TrainingGoalRecord | null;
  availability: AvailabilityRecord[];
  fitnessSummary?: FitnessSummary | null;
  fitnessHistory?: DailyFitnessRecord[];
  activities?: NormalizedActivity[];
  weekMonday?: Date;
  workoutOverrides?: Record<string, string>;
}

const DUTCH_DAYS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const DUTCH_SHORT_DAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const DUTCH_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/**
 * Generate a complete 7-day deterministic training schedule (Monday to Sunday)
 */
export function generateWeekPlan(options: GeneratePlanOptions): PlannedWeekDay[] {
  const {
    profile,
    goal,
    availability,
    fitnessHistory = [],
    activities = [],
    weekMonday,
    workoutOverrides = {}
  } = options;

  const ftp = profile?.ftp || 250;
  const goalType = goal?.type || 'ftp_increase';

  // Calculate Monday of current week if not supplied
  const now = new Date();
  let monday: Date;
  if (weekMonday) {
    monday = new Date(weekMonday);
  } else {
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    monday = new Date(now);
    monday.setDate(diff);
  }
  monday.setHours(0, 0, 0, 0);

  // Index activities by YYYY-MM-DD
  const actsByDate = new Map<string, NormalizedActivity[]>();
  for (const act of activities) {
    const d = (act.start_date || '').slice(0, 10);
    if (d) {
      const list = actsByDate.get(d) || [];
      list.push(act);
      actsByDate.set(d, list);
    }
  }

  // Find latest TSB if available
  const latestTsb = options.fitnessSummary?.currentTsb ?? (
    fitnessHistory && fitnessHistory.length > 0 
      ? fitnessHistory[fitnessHistory.length - 1].tsb 
      : 0
  );

  // Create a 7-day availability lookup (0=Mon ... 6=Sun)
  const availMap = new Map<number, AvailabilityRecord>();
  availability.forEach((rec, idx) => {
    const dayIdx = rec.day_of_week !== undefined ? rec.day_of_week : idx;
    availMap.set(dayIdx, rec);
  });

  const plannedDays: PlannedWeekDay[] = [];
  let intensiveSessionsCount = 0;
  let previousDayWasIntensive = false;

  for (let i = 0; i < 7; i++) {
    const curDate = new Date(monday);
    curDate.setDate(monday.getDate() + i);
    const dateKey = curDate.toISOString().slice(0, 10);

    const isToday = curDate.toDateString() === now.toDateString();
    const isPast = curDate < now && !isToday;
    const isFuture = curDate > now && !isToday;

    // Availability for this day
    const dayAvail = availMap.get(i) || {
      day_of_week: i,
      day_name: DUTCH_DAYS[i],
      minutes: i === 0 || i === 4 ? 0 : (i === 5 ? 180 : (i === 6 ? 120 : 60)),
      preference: (i === 0 || i === 4 ? 'rest' : 'both') as 'indoor' | 'outdoor' | 'both' | 'rest',
      updated_at: Date.now()
    };

    const completed = actsByDate.get(dateKey) || [];
    const isCompleted = completed.length > 0;
    const totalActualTss = completed.reduce((sum, a) => {
      const anyA = a as unknown as Record<string, unknown>;
      const val = typeof anyA.tss === 'number' ? anyA.tss : (typeof anyA.analyzedLoad === 'number' ? anyA.analyzedLoad : (typeof a.suffer_score === 'number' ? a.suffer_score : 0));
      return sum + val;
    }, 0);
    const totalActualDurationMinutes = Math.round(
      completed.reduce((sum, a) => sum + (a.moving_time || 0), 0) / 60
    );

    // If an activity was completed, did it count as an intensive session?
    const wasHighIntensityRide = completed.some(a => {
      const anyA = a as unknown as Record<string, unknown>;
      const loadVal = typeof anyA.tss === 'number' ? anyA.tss : (typeof anyA.analyzedLoad === 'number' ? anyA.analyzedLoad : (typeof a.suffer_score === 'number' ? a.suffer_score : 0));
      return loadVal > 70 || (a.weighted_average_watts != null && a.weighted_average_watts > ftp * 0.85);
    });
    if (isCompleted) {
      if (wasHighIntensityRide) {
        intensiveSessionsCount++;
        previousDayWasIntensive = true;
      } else {
        previousDayWasIntensive = false;
      }
    }

    // Deterministic Workout Selector
    let workout: ComputedWorkout;
    let plannedType: 'Endurance' | 'Threshold' | 'Power' | 'Rest' = 'Rest';
    let plannedCategory: WorkoutCategory = 'rest';
    let plannedReason = '';
    let reasonCode = 'REST_DEFAULT';

    const availMinutes = Math.max(0, dayAvail.minutes);
    const isRestPreference = dayAvail.preference === 'rest' || availMinutes === 0;

    // Check manual override first
    const overrideId = workoutOverrides[dateKey];

    if (overrideId && WORKOUT_TEMPLATES[overrideId]) {
      const template = WORKOUT_TEMPLATES[overrideId];
      const targetMins = template.category === 'rest' ? 0 : (availMinutes || template.durationMinutes);
      workout = scaleWorkoutToMinutes(template, targetMins, ftp);
      plannedCategory = template.category;
      if (template.category === 'vo2max' || template.category === 'anaerobic') plannedType = 'Power';
      else if (template.category === 'threshold' || template.category === 'sweetspot') plannedType = 'Threshold';
      else if (template.category === 'endurance' || template.category === 'tempo') plannedType = 'Endurance';
      else plannedType = 'Rest';
      plannedReason = `Handmatig geselecteerde training: ${template.title}.`;
      reasonCode = 'MANUAL_OVERRIDE';
      if (!isCompleted && (plannedType === 'Power' || plannedType === 'Threshold')) {
        intensiveSessionsCount++;
        previousDayWasIntensive = true;
      }
    } else if (isRestPreference) {
      // RULE 1: STRICT AVAILABILITY CONSTRAINT
      workout = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.rest, 0, ftp);
      plannedType = 'Rest';
      plannedCategory = 'rest';
      reasonCode = 'REST_SCHEDULED';
      plannedReason = i === 0 
        ? 'Hersteldag conform je weekbeschikbaarheid om de benen te sparen na het trainingsweekend.'
        : `Rustdag conform je ingestelde beschikbaarheid (0 min). Tijd voor herstel en spieradaptatie.`;
      previousDayWasIntensive = false;
    } else {
      // The athlete has available training time!
      const canDoIntensive = intensiveSessionsCount < 2 && !previousDayWasIntensive && latestTsb >= -25;
      const isIndoorFocus = dayAvail.preference === 'indoor';

      // Weekend Endurance Days
      if (i === 5) { // Zaterdag
        const template = availMinutes >= 120 ? WORKOUT_TEMPLATES.endurance_long : WORKOUT_TEMPLATES.endurance_90;
        workout = scaleWorkoutToMinutes(template, availMinutes, ftp);
        plannedType = 'Endurance';
        plannedCategory = 'endurance';
        reasonCode = 'WEEKEND_LONG_ENDURANCE';
        plannedReason = `Lange weekendrit (${availMinutes} min) in Zone 2 om je aerobe basis en vetverbranding maximaal uit te bouwen.`;
        previousDayWasIntensive = false;
      } else if (i === 6) { // Zondag
        const template = availMinutes >= 120 ? WORKOUT_TEMPLATES.endurance_90 : WORKOUT_TEMPLATES.endurance_60;
        workout = scaleWorkoutToMinutes(template, availMinutes, ftp);
        plannedType = 'Endurance';
        plannedCategory = 'endurance';
        reasonCode = 'WEEKEND_ENDURANCE_BASE';
        plannedReason = `Vrije duurtraining of clubrit (${availMinutes} min) met stabiele aerobe intensiteit.`;
        previousDayWasIntensive = false;
      } else {
        // Midweek Training Days (Dinsdag, Woensdag, Donderdag, Vrijdag)
        const shouldDoIntensive = (canDoIntensive || (isToday && isIndoorFocus)) && availMinutes >= 45;

        if (shouldDoIntensive) {
          if (!isCompleted) {
            intensiveSessionsCount++;
            previousDayWasIntensive = true;
          }

          if (isIndoorFocus || goalType === 'racing') {
            // VO2 Max 40/20 Micro-bursts (ideal for indoor or racing focus)
            workout = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.vo2max_40_20, availMinutes, ftp);
            plannedType = 'Power';
            plannedCategory = 'vo2max';
            reasonCode = 'VO2MAX_MICROBURSTS';
            plannedReason = `Kwaliteitssessie van ${availMinutes} min: VO₂ Max 40/20 intervallen om je cardiovasculaire piek en lactaattolerantie te stimuleren.`;
          } else if (goalType === 'ftp_increase' || goalType === 'gran_fondo') {
            if (availMinutes >= 60) {
              // Sweet Spot 3x12 min or Threshold
              workout = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.sweetspot_3x12, availMinutes, ftp);
              plannedType = 'Threshold';
              plannedCategory = 'sweetspot';
              reasonCode = 'SWEETSPOT_BUILD';
              plannedReason = `Sweet Spot blokken van ${availMinutes} min op 88-92% FTP. De meest effectieve manier om je aerobe drempel te verhogen.`;
            } else {
              workout = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.vo2max_40_20, availMinutes, ftp);
              plannedType = 'Power';
              plannedCategory = 'vo2max';
              reasonCode = 'VO2MAX_SHORT';
              plannedReason = `Snelle indoor VO₂ Max sessie van ${availMinutes} min binnen je beschikbare tijdvenster.`;
            }
          } else {
            // Default threshold
            workout = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.threshold_2x20, availMinutes, ftp);
            plannedType = 'Threshold';
            plannedCategory = 'threshold';
            reasonCode = 'THRESHOLD_INTERVALS';
            plannedReason = `Drempelintervallen van ${availMinutes} min op 98-100% FTP.`;
          }
        } else {
          // Aerobic Endurance or Recovery
          previousDayWasIntensive = false;
          if (availMinutes <= 45 || latestTsb < -20) {
            workout = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.recovery_spin, availMinutes, ftp);
            plannedType = 'Rest';
            plannedCategory = 'recovery';
            reasonCode = 'ACTIVE_RECOVERY';
            plannedReason = `Actieve herstelrit van ${availMinutes} min (<55% FTP) om de benen los te rijden zonder extra vermoeidheid.`;
          } else {
            const template = availMinutes >= 90 ? WORKOUT_TEMPLATES.endurance_90 : WORKOUT_TEMPLATES.endurance_60;
            workout = scaleWorkoutToMinutes(template, availMinutes, ftp);
            plannedType = 'Endurance';
            plannedCategory = 'endurance';
            reasonCode = 'MIDWEEK_ENDURANCE';
            plannedReason = `Aerobe duurtraining (${availMinutes} min) in Zone 2 om je basisconditie te versterken.`;
          }
        }
      }
    }

    plannedDays.push({
      date: curDate,
      dateKey,
      dayOfWeek: i,
      dayName: DUTCH_DAYS[i],
      shortName: DUTCH_SHORT_DAYS[i],
      dayNumber: curDate.getDate(),
      monthName: DUTCH_MONTHS[curDate.getMonth()],
      isToday,
      isPast,
      isFuture,
      availableMinutes: availMinutes,
      preference: dayAvail.preference,
      plannedType,
      plannedCategory,
      plannedTitle: workout.title,
      plannedDuration: workout.totalDurationFormatted,
      plannedMinutes: workout.durationMinutes,
      plannedWatts: workout.calculatedWattsSummary || '-',
      plannedTss: workout.estimatedTss,
      plannedReason,
      reasonCode,
      workout,
      completedActivities: completed,
      isCompleted,
      totalActualTss,
      totalActualDurationMinutes
    });
  }

  return plannedDays;
}
