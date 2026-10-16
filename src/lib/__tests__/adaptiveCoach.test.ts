import { describe, it, expect, beforeAll } from 'vitest';
import { 
  classifyDayExecution, 
  generateAdaptiveReplanProposal, 
  acceptProposal, 
  declineProposal,
  getDeclinedProposalIds 
} from '../adaptiveCoach';
import type { PlannedWeekDay } from '../trainingPlanner';
import { scaleWorkoutToMinutes, WORKOUT_TEMPLATES } from '../workoutLibrary';

class MockStorage {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

describe('Adaptive Coach Feedback Loop', () => {
  beforeAll(() => {
    const mock = new MockStorage();
    // @ts-expect-error test mock
    globalThis.localStorage = mock;
    // @ts-expect-error test mock
    globalThis.window = { localStorage: mock };
  });

  const dummyWorkout = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.vo2max_40_20, 60, 250);

  const createMockDay = (overrides: Partial<PlannedWeekDay>): PlannedWeekDay => ({
    date: new Date(),
    dateKey: '2026-10-15',
    dayOfWeek: 3,
    dayName: 'Donderdag',
    shortName: 'Do',
    dayNumber: 15,
    monthName: 'okt',
    isToday: false,
    isPast: true,
    isFuture: false,
    availableMinutes: 60,
    preference: 'indoor',
    plannedType: 'Power',
    plannedCategory: 'vo2max',
    plannedTitle: 'VO₂ Max 40/20 Intervallen',
    plannedDuration: '60 min',
    plannedMinutes: 60,
    plannedWatts: '300W',
    plannedTss: 65,
    plannedReason: 'Kwaliteitssessie',
    reasonCode: 'QUALITY_SESSION',
    workout: dummyWorkout,
    completedActivities: [],
    isCompleted: false,
    totalActualTss: 0,
    totalActualDurationMinutes: 0,
    ...overrides
  });

  it('classifies a past workout without rides as missed', () => {
    const day = createMockDay({ isPast: true, isCompleted: false });
    const analysis = classifyDayExecution(day);

    expect(analysis.classification).toBe('missed');
    expect(analysis.tssDifference).toBe(-65);
  });

  it('classifies an unplanned ride on a rest day', () => {
    const day = createMockDay({
      plannedCategory: 'rest',
      plannedType: 'Rest',
      isCompleted: true,
      totalActualTss: 90
    });
    const analysis = classifyDayExecution(day);

    expect(analysis.classification).toBe('unplanned_ride');
    expect(analysis.actualTss).toBe(90);
  });

  it('proposes to shift a missed intensive session when athlete freshness is good (TSB > -8)', () => {
    const missedDay = createMockDay({
      dateKey: '2026-10-15',
      dayOfWeek: 3,
      dayName: 'Donderdag',
      isPast: true,
      isCompleted: false,
      plannedType: 'Power'
    });

    const todayFriday = createMockDay({
      dateKey: '2026-10-16',
      dayOfWeek: 4,
      dayName: 'Vrijdag',
      isPast: false,
      isToday: true,
      isCompleted: false,
      availableMinutes: 60,
      plannedType: 'Rest',
      plannedCategory: 'rest'
    });

    const proposal = generateAdaptiveReplanProposal([missedDay, todayFriday], +5);

    expect(proposal).not.toBeNull();
    expect(proposal?.triggerType).toBe('missed_workout');
    expect(proposal?.title).toContain('Gemiste intensieve sessie');
    expect(proposal?.changes[0].dateKey).toBe('2026-10-16');
    expect(proposal?.changes[0].proposedType).toBe('Power');
  });

  it('proposes fatigue recovery when an unplanned heavy ride caused high acute fatigue (TSB <= -10)', () => {
    const heavyThursday = createMockDay({
      dateKey: '2026-10-15',
      dayOfWeek: 3,
      dayName: 'Donderdag',
      isPast: true,
      isCompleted: true,
      totalActualTss: 130, // Unplanned heavy ride
      plannedCategory: 'rest'
    });

    const upcomingFriday = createMockDay({
      dateKey: '2026-10-16',
      dayOfWeek: 4,
      dayName: 'Vrijdag',
      isPast: false,
      isToday: true,
      isCompleted: false,
      plannedType: 'Power'
    });

    const proposal = generateAdaptiveReplanProposal([heavyThursday, upcomingFriday], -15);

    expect(proposal).not.toBeNull();
    expect(proposal?.triggerType).toBe('heavy_fatigue');
    expect(proposal?.title).toContain('Vermoeidheidsbescherming');
    expect(proposal?.changes[0].proposedType).toBe('Endurance');
  });

  it('accepts proposal and updates overrides record', () => {
    const proposal = {
      id: 'test_proposal',
      title: 'Test',
      triggerType: 'missed_workout' as const,
      triggerDescription: 'test',
      consequenceIfNotAccepted: 'test',
      changes: [
        {
          dateKey: '2026-10-16',
          dayOfWeek: 4,
          dayName: 'Vrijdag',
          originalTitle: 'Rust',
          originalType: 'Rest',
          proposedTemplateId: 'vo2max_40_20',
          proposedTitle: 'VO₂ Max 40/20',
          proposedType: 'Power',
          proposedCategory: 'vo2max' as const,
          reason: 'Test'
        }
      ],
      createdAt: Date.now()
    };

    const nextOverrides = acceptProposal(proposal, {});
    expect(nextOverrides['2026-10-16']).toBe('vo2max_40_20');
  });

  it('declines a proposal and persists to declined list', () => {
    declineProposal('proposal_xyz');
    const declined = getDeclinedProposalIds();
    expect(declined).toContain('proposal_xyz');
  });
});
