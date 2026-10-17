import { describe, it, expect } from 'vitest';
import { generateWeekPlan } from '../trainingPlanner';
import { scaleWorkoutToMinutes, WORKOUT_TEMPLATES } from '../workoutLibrary';
import { formatLocalDateKey } from '../physiology';
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

  it('correctly plans VO2 max 40/20 on Friday when Tuesday and Wednesday had rides and Thursday was rest', () => {
    const tuesdayDate = new Date();
    // Monday = cur - (day === 0 ? 6 : day - 1)
    const day = tuesdayDate.getDay();
    const mondayDiff = tuesdayDate.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(tuesdayDate);
    mon.setDate(mondayDiff);
    mon.setHours(0, 0, 0, 0);

    const tue = new Date(mon);
    tue.setDate(mon.getDate() + 1);
    tue.setHours(12, 0, 0, 0);
    const wed = new Date(mon);
    wed.setDate(mon.getDate() + 2);
    wed.setHours(12, 0, 0, 0);

    const activities = [
      {
        id: 101,
        name: 'Morning Commute',
        start_date: tue.toISOString(),
        start_date_local: formatLocalDateKey(tue) + 'T08:30:00',
        type: 'Ride',
        sport_type: 'Ride',
        distance: 15000,
        moving_time: 2400,
        elapsed_time: 2500,
        total_elevation_gain: 50,
        average_watts: 106,
        weighted_average_watts: null,
        max_watts: null,
        device_watts: false,
        has_heartrate: false,
        average_heartrate: null,
        max_heartrate: null,
        average_cadence: null,
        trainer: false,
        commute: true,
        suffer_score: 62,
        has_stream: false,
        raw_json: {},
        created_at: Date.now(),
        updated_at: Date.now()
      },
      {
        id: 102,
        name: 'Afternoon Ride',
        start_date: wed.toISOString(),
        start_date_local: formatLocalDateKey(wed) + 'T14:00:00',
        type: 'Ride',
        sport_type: 'Ride',
        distance: 63000,
        moving_time: 7740,
        elapsed_time: 8000,
        total_elevation_gain: 300,
        average_watts: 194,
        weighted_average_watts: 210,
        max_watts: null,
        device_watts: true,
        has_heartrate: true,
        average_heartrate: 145,
        max_heartrate: 175,
        average_cadence: 88,
        trainer: false,
        commute: false,
        suffer_score: 117,
        has_stream: false,
        raw_json: {},
        created_at: Date.now(),
        updated_at: Date.now()
      }
    ];

    const plan = generateWeekPlan({
      profile: mockProfile,
      goal: mockGoal,
      availability: userAvailability,
      activities,
      weekMonday: mon
    });

    const friday = plan[4];
    expect(friday.dayName).toBe('Vrijdag');
    expect(friday.plannedType).toBe('Power');
    expect(friday.workout.id).toBe('vo2max_40_20');
    expect(friday.plannedTitle).toContain('VO₂ Max 40/20');
  });

  it('respects user manual workout overrides', () => {
    const monday = new Date();
    const dateKey = formatLocalDateKey(monday);
    const plan = generateWeekPlan({
      profile: mockProfile,
      goal: mockGoal,
      availability: userAvailability,
      workoutOverrides: {
        [dateKey]: 'vo2max_40_20'
      }
    });

    const overriddenDay = plan.find(d => d.dateKey === dateKey);
    expect(overriddenDay).toBeDefined();
    expect(overriddenDay?.workout.id).toBe('vo2max_40_20');
    expect(overriddenDay?.reasonCode).toBe('MANUAL_OVERRIDE');
  });

  it('correctly binds a Friday Zwift activity to Friday (not Saturday) regardless of local midnight timezone offsets', () => {
    // Simulate Monday Oct 12, 2026
    const monday = new Date(2026, 9, 12, 0, 0, 0, 0); // Oct is month index 9
    
    // Activity on Friday Oct 16, 2026 at 13:00 local time
    const fridayActivity = {
      id: 9999,
      name: 'Zwift - VO2 Max Workout',
      start_date: '2026-10-16T11:00:00Z',
      start_date_local: '2026-10-16T13:00:00',
      type: 'Ride',
      sport_type: 'VirtualRide',
      distance: 23000,
      moving_time: 2580,
      elapsed_time: 2600,
      total_elevation_gain: 150,
      average_watts: 183,
      weighted_average_watts: 215,
      max_watts: 450,
      device_watts: true,
      has_heartrate: true,
      average_heartrate: 152,
      max_heartrate: 178,
      average_cadence: 85,
      trainer: true,
      commute: false,
      suffer_score: 54,
      has_stream: false,
      raw_json: {},
      created_at: Date.now(),
      updated_at: Date.now()
    };

    const plan = generateWeekPlan({
      profile: mockProfile,
      goal: mockGoal,
      availability: userAvailability,
      activities: [fridayActivity],
      weekMonday: monday
    });

    const friday = plan[4];
    const saturday = plan[5];

    expect(friday.dayName).toBe('Vrijdag');
    expect(friday.dateKey).toBe('2026-10-16');
    expect(friday.isCompleted).toBe(true);
    expect(friday.completedActivities).toHaveLength(1);
    expect(friday.completedActivities[0].name).toBe('Zwift - VO2 Max Workout');

    expect(saturday.dayName).toBe('Zaterdag');
    expect(saturday.dateKey).toBe('2026-10-17');
    expect(saturday.isCompleted).toBe(false);
    expect(saturday.completedActivities).toHaveLength(0);
  });
});

