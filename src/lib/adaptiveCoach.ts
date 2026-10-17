/**
 * Adaptive Coach & Intelligent Feedback Loop for Watts Next
 * 
 * Analyzes planned workouts against actual Strava activities, detects deviations
 * (missed workouts, excessive loads, unplanned rides), and generates transparent
 * replan proposals that require explicit user consent.
 */

import type { PlannedWeekDay } from './trainingPlanner';
import { WORKOUT_TEMPLATES, type WorkoutCategory } from './workoutLibrary';

export type ActivityMatchClassification =
  | 'completed_as_planned'
  | 'harder_than_planned'
  | 'lighter_than_planned'
  | 'missed'
  | 'unplanned_ride'
  | 'rest_as_planned'
  | 'upcoming';

export interface DayExecutionAnalysis {
  dateKey: string;
  dayOfWeek: number;
  dayName: string;
  classification: ActivityMatchClassification;
  plannedTss: number;
  actualTss: number;
  tssDifference: number;
  details: string;
}

export interface ReplanChange {
  dateKey: string;
  dayOfWeek: number;
  dayName: string;
  originalTitle: string;
  originalType: string;
  proposedTemplateId: string;
  proposedTitle: string;
  proposedType: string;
  proposedCategory: WorkoutCategory;
  reason: string;
}

export interface ReplanProposal {
  id: string;
  title: string;
  triggerType: 'missed_workout' | 'heavy_fatigue' | 'unplanned_load';
  triggerDescription: string;
  consequenceIfNotAccepted: string;
  changes: ReplanChange[];
  createdAt: number;
}

/**
 * Classifies the execution of a planned week day against completed Strava rides
 */
export function classifyDayExecution(day: PlannedWeekDay): DayExecutionAnalysis {
  const actualTss = Math.round(day.totalActualTss || 0);
  const plannedTss = Math.round(day.plannedTss || 0);
  const diff = actualTss - plannedTss;
  const isRest =
    day.plannedCategory === 'rest' ||
    day.plannedCategory === 'recovery' ||
    day.plannedType === 'Rest' ||
    day.preference === 'rest' ||
    day.availableMinutes === 0;

  if (day.isFuture) {
    return {
      dateKey: day.dateKey,
      dayOfWeek: day.dayOfWeek,
      dayName: day.dayName,
      classification: 'upcoming',
      plannedTss,
      actualTss,
      tssDifference: 0,
      details: 'Toekomstige geplande trainingsdag'
    };
  }

  // Today with no ride yet
  if (day.isToday && !day.isCompleted) {
    return {
      dateKey: day.dateKey,
      dayOfWeek: day.dayOfWeek,
      dayName: day.dayName,
      classification: 'upcoming',
      plannedTss,
      actualTss: 0,
      tssDifference: -plannedTss,
      details: 'Gepland voor vandaag, nog niet gereden'
    };
  }

  // Rest day analysis
  if (isRest) {
    if (day.isCompleted && actualTss > 20) {
      return {
        dateKey: day.dateKey,
        dayOfWeek: day.dayOfWeek,
        dayName: day.dayName,
        classification: 'unplanned_ride',
        plannedTss: 0,
        actualTss,
        tssDifference: actualTss,
        details: `Ongeplande rit op rustdag (${actualTss} TSS)`
      };
    }
    return {
      dateKey: day.dateKey,
      dayOfWeek: day.dayOfWeek,
      dayName: day.dayName,
      classification: 'rest_as_planned',
      plannedTss: 0,
      actualTss: 0,
      tssDifference: 0,
      details: 'Rustdag zoals gepland'
    };
  }

  // Training day with no ride in the past
  if (!day.isCompleted && day.isPast) {
    return {
      dateKey: day.dateKey,
      dayOfWeek: day.dayOfWeek,
      dayName: day.dayName,
      classification: 'missed',
      plannedTss,
      actualTss: 0,
      tssDifference: -plannedTss,
      details: `Geplande training (${day.plannedTitle}) niet uitgevoerd`
    };
  }

  // Training day with completed ride
  if (day.isCompleted) {
    // If actual TSS is significantly higher than planned (> 35% higher and > 25 TSS diff)
    if (actualTss > plannedTss * 1.35 && diff > 25) {
      return {
        dateKey: day.dateKey,
        dayOfWeek: day.dayOfWeek,
        dayName: day.dayName,
        classification: 'harder_than_planned',
        plannedTss,
        actualTss,
        tssDifference: diff,
        details: `Zwaarder getraind dan gepland (+${diff} TSS)`
      };
    }

    // If actual TSS is significantly lower than planned (< 65% of planned)
    if (actualTss < plannedTss * 0.65 && plannedTss > 30) {
      return {
        dateKey: day.dateKey,
        dayOfWeek: day.dayOfWeek,
        dayName: day.dayName,
        classification: 'lighter_than_planned',
        plannedTss,
        actualTss,
        tssDifference: diff,
        details: `Lichter/korter getraind dan gepland (${diff} TSS)`
      };
    }

    return {
      dateKey: day.dateKey,
      dayOfWeek: day.dayOfWeek,
      dayName: day.dayName,
      classification: 'completed_as_planned',
      plannedTss,
      actualTss,
      tssDifference: diff,
      details: `Voltooid conform plan (${actualTss} TSS)`
    };
  }

  return {
    dateKey: day.dateKey,
    dayOfWeek: day.dayOfWeek,
    dayName: day.dayName,
    classification: 'upcoming',
    plannedTss,
    actualTss,
    tssDifference: diff,
    details: 'Status in afwachting'
  };
}

/**
 * Evaluates the current plan and history to generate an intelligent replan proposal
 * when athlete training deviates from the deterministic plan.
 */
export function generateAdaptiveReplanProposal(
  weekPlan: PlannedWeekDay[],
  currentTsb: number = 0,
  options?: {
    ignoredProposalIds?: string[];
  }
): ReplanProposal | null {
  const ignored = new Set(options?.ignoredProposalIds || getDeclinedProposalIds());
  const analyses = weekPlan.map(classifyDayExecution);

  // SCENARIO 1: Missed high-intensity workout (e.g. missed Thursday VO2max or Sweetspot)
  // Check if a quality session was missed in the past few days of this week
  const missedIntensiveDay = weekPlan.find((day, idx) => {
    const analysis = analyses[idx];
    const isConfiguredRest =
      day.preference === 'rest' ||
      day.availableMinutes === 0 ||
      day.plannedType === 'Rest' ||
      day.plannedCategory === 'rest';

    return (
      !isConfiguredRest &&
      analysis.classification === 'missed' &&
      (day.plannedType === 'Power' || day.plannedType === 'Threshold')
    );
  });

  if (missedIntensiveDay && currentTsb >= -8) {
    // Look for an upcoming day (today or future) that has >= available time and is currently light or rest
    const candidateDay = weekPlan.find(day => {
      if (!day.isToday && !day.isFuture) return false;
      if (day.availableMinutes < 45) return false;
      if (day.preference === 'rest') return false;
      // Candidate should currently not be an intensive session
      return day.plannedType === 'Rest' || day.plannedType === 'Endurance';
    });

    if (candidateDay) {
      const templateId = missedIntensiveDay.workout.id || 'vo2max_40_20';
      const template = WORKOUT_TEMPLATES[templateId] || WORKOUT_TEMPLATES.vo2max_40_20;
      const proposalId = `replan_shift_missed_${missedIntensiveDay.dateKey}_to_${candidateDay.dateKey}`;

      if (!ignored.has(proposalId)) {
        return {
          id: proposalId,
          title: 'Gemiste intensieve sessie inhalen',
          triggerType: 'missed_workout',
          triggerDescription: `Je hebt op ${missedIntensiveDay.dayName} de geplande ${missedIntensiveDay.plannedTitle} niet gereden. Omdat je actuele frisheid (TSB ${currentTsb > 0 ? '+' : ''}${currentTsb}) uitstekend is, kan deze prikkel veilig worden doorgeschoven naar ${candidateDay.dayName}.`,
          consequenceIfNotAccepted:
            'Als je het huidige schema aanhoudt, mis je deze week een cruciale intensieve kwaliteitssessie voor je FTP-ontwikkeling.',
          changes: [
            {
              dateKey: candidateDay.dateKey,
              dayOfWeek: candidateDay.dayOfWeek,
              dayName: candidateDay.dayName,
              originalTitle: candidateDay.plannedTitle,
              originalType: candidateDay.plannedType,
              proposedTemplateId: template.id,
              proposedTitle: template.title,
              proposedType: template.category === 'vo2max' ? 'Power' : 'Threshold',
              proposedCategory: template.category,
              reason: `Doorgeschoven vanaf ${missedIntensiveDay.dayName} i.v.m. uitstekende actuele frisheid (TSB ${currentTsb}).`
            }
          ],
          createdAt: Date.now()
        };
      }
    }
  }

  // SCENARIO 2: Excessive fatigue or heavy unplanned training
  // Check if athlete performed a significantly harder ride or unplanned ride that induces high fatigue
  const heavyDay = weekPlan.find((_, idx) => {
    const analysis = analyses[idx];
    return (
      (analysis.classification === 'harder_than_planned' || analysis.classification === 'unplanned_ride') &&
      analysis.actualTss >= 80
    );
  });

  if (heavyDay && currentTsb <= -10) {
    // Find next upcoming high-intensity session
    const upcomingIntensive = weekPlan.find(day => {
      if (!day.isToday && !day.isFuture) return false;
      return day.plannedType === 'Power' || day.plannedType === 'Threshold';
    });

    if (upcomingIntensive) {
      const proposalId = `replan_recovery_fatigue_${heavyDay.dateKey}_relieve_${upcomingIntensive.dateKey}`;

      if (!ignored.has(proposalId)) {
        return {
          id: proposalId,
          title: 'Vermoeidheidsbescherming (Overreach Preventie)',
          triggerType: 'heavy_fatigue',
          triggerDescription: `Door je zware belasting op ${heavyDay.dayName} (${Math.round(heavyDay.totalActualTss)} TSS) is je trainingsbalans gedaald naar TSB ${currentTsb}. Je lichaam heeft herstel nodig.`,
          consequenceIfNotAccepted:
            'Een zware intervaltraining afwerken bij hoge acute vermoeidheid verhoogt de kans op blessures, ziekte en afnemend trainingsrendement.',
          changes: [
            {
              dateKey: upcomingIntensive.dateKey,
              dayOfWeek: upcomingIntensive.dayOfWeek,
              dayName: upcomingIntensive.dayName,
              originalTitle: upcomingIntensive.plannedTitle,
              originalType: upcomingIntensive.plannedType,
              proposedTemplateId: 'endurance_60',
              proposedTitle: 'Herstellende Duurrit (Z2)',
              proposedType: 'Endurance',
              proposedCategory: 'endurance',
              reason: `Vervanging van zware intervallen door rustige duurtraining i.v.m. vermoeidheid (TSB ${currentTsb}).`
            }
          ],
          createdAt: Date.now()
        };
      }
    }
  }

  return null;
}

/**
 * Storage helpers for accepted and declined proposals
 */
const STORAGE_KEY_DECLINED = 'watts_declined_proposals';

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function getDeclinedProposalIds(): string[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    return JSON.parse(storage.getItem(STORAGE_KEY_DECLINED) || '[]');
  } catch {
    return [];
  }
}

export function declineProposal(proposalId: string): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const list = getDeclinedProposalIds();
    if (!list.includes(proposalId)) {
      list.push(proposalId);
      storage.setItem(STORAGE_KEY_DECLINED, JSON.stringify(list));
    }
  } catch (e) {
    console.warn('Failed to save declined proposal:', e);
  }
}

export function acceptProposal(
  proposal: ReplanProposal,
  currentOverrides: Record<string, string> = {}
): Record<string, string> {
  const updatedOverrides = { ...currentOverrides };
  for (const change of proposal.changes) {
    updatedOverrides[change.dateKey] = change.proposedTemplateId;
  }

  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem('watts_workout_overrides', JSON.stringify(updatedOverrides));
      // Mark as accepted
      storage.setItem(`watts_accepted_proposal_${proposal.id}`, JSON.stringify(proposal));
    } catch (e) {
      console.warn('Failed to save accepted proposal overrides:', e);
    }
  }

  return updatedOverrides;
}
