import { describe, it, expect } from 'vitest';
import { generateWeekPlan } from '../trainingPlanner';
import { scaleWorkoutToMinutes, WORKOUT_TEMPLATES } from '../workoutLibrary';
import type { AvailabilityRecord, AthleteProfileRecord, TrainingGoalRecord } from '../db';

describe('Workout Library & Scaling Engine', () => {
  it('computes exact watts for workout steps based on FTP', () => {
    const ftp = 250;
    const scaled = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.vo2max_40_20, 60, ftp);
    expect(scaled.durationMinutes).toBe(60);
    expect(scaled.computedSteps.length).toBeGreaterThan(0);

    // Find the 120% FTP step
    const intervalStep = scaled.computedSteps.find(s => s.targetFtpPercent === 1.20);
    expect(intervalStep).toBeDefined();
    // 250 * 1.20 = 300W
    expect(intervalStep?.targetWattsLow).toBe(300);
  });

  it('handles 0 minute rest requests gracefully', () => {
    const scaled = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.sweetspot_3x12, 0, 250);
    expect(scaled.durationMinutes).toBe(0);
    expect(scaled.category).toBe('rest');
    expect(scaled.computedSteps).toHaveLength(0);
  });

  it('scales duration to fit available time without exceeding it', () => {
    const scaled = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.endurance_90, 75, 200);
    expect(scaled.durationMinutes).toBe(75);
    const totalSeconds = scaled.computedSteps.reduce((acc, s) => acc + s.durationSeconds, 0);
    expect(totalSeconds).toBe(75 * 60);
  });
});

describe('Deterministic Training Plan Generator', () => {
  const mockProfile: AthleteProfileRecord = {
    ftp: 250,
    weight: 75,
    max_heartrate: 190,
    experience_level: 'intermediate',
    created_at: Date.now(),
    updated_at: Date.now()
  };

  const mockGoal: TrainingGoalRecord = {
    type: 'ftp_increase',
    title: 'FTP Drempelverhoging',
    active: true,
    created_at: Date.now()
  };

  // User's exact availability from screenshot:
  // Ma: 0, Di: 75, Wo: 90, Do: 0 (Rust), Vr: 60 (Indoor), Za: 180 (Outdoor), Zo: 120 (Outdoor)
  const userAvailability: AvailabilityRecord[] = [
    { day_of_week: 0, day_name: 'Maandag', minutes: 0, preference: 'rest', updated_at: Date.now() },
    { day_of_week: 1, day_name: 'Dinsdag', minutes: 75, preference: 'both', updated_at: Date.now() },
    { day_of_week: 2, day_name: 'Woensdag', minutes: 90, preference: 'both', updated_at: Date.now() },
    { day_of_week: 3, day_name: 'Donderdag', minutes: 0, preference: 'rest', updated_at: Date.now() },
    { day_of_week: 4, day_name: 'Vrijdag', minutes: 60, preference: 'indoor', updated_at: Date.now() },
    { day_of_week: 5, day_name: 'Zaterdag', minutes: 180, preference: 'outdoor', updated_at: Date.now() },
    { day_of_week: 6, day_name: 'Zondag', minutes: 120, preference: 'outdoor', updated_at: Date.now() },
  ];

  it('STRICTLY plans Thursday as REST when set to 0 minutes and rest preference', () => {
    const plan = generateWeekPlan({
      profile: mockProfile,
      goal: mockGoal,
      availability: userAvailability
    });

    expect(plan).toHaveLength(7);
    const thursday = plan[3];
    expect(thursday.dayName).toBe('Donderdag');
    expect(thursday.plannedType).toBe('Rest');
    expect(thursday.plannedMinutes).toBe(0);
    expect(thursday.plannedReason).toContain('Rustdag conform');
  });

  it('PLANS Friday as an intensive training session when 60 min indoor is available', () => {
    const plan = generateWeekPlan({
      profile: mockProfile,
      goal: mockGoal,
      availability: userAvailability
    });

    const friday = plan[4];
    expect(friday.dayName).toBe('Vrijdag');
    expect(friday.plannedType).not.toBe('Rest');
    expect(friday.plannedMinutes).toBe(60);
    // Since Friday has indoor preference, it schedules VO2 max or sweetspot
    expect(['Power', 'Threshold']).toContain(friday.plannedType);
    expect(friday.workout.computedSteps.length).toBeGreaterThan(0);
  });

  it('never exceeds the configured available minutes on any day of the week', () => {
    const plan = generateWeekPlan({
      profile: mockProfile,
      goal: mockGoal,
      availability: userAvailability
    });

    plan.forEach(day => {
      expect(day.plannedMinutes).toBeLessThanOrEqual(day.availableMinutes);
    });
  });

  it('limits high-intensity sessions to at most 2 per week', () => {
    const plan = generateWeekPlan({
      profile: mockProfile,
      goal: mockGoal,
      availability: userAvailability
    });

    const intensiveDays = plan.filter(d => d.plannedType === 'Power' || d.plannedType === 'Threshold');
    expect(intensiveDays.length).toBeLessThanOrEqual(2);
  });
});
