import { describe, it, expect } from 'vitest';
import { generateZwoXml } from '../zwiftExport';
import { scaleWorkoutToMinutes, WORKOUT_TEMPLATES } from '../workoutLibrary';

describe('Zwift .zwo Export Generator', () => {
  it('generates valid Zwift XML with required tags and steps', () => {
    const workout = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.vo2max_40_20, 60, 250);
    const xml = generateZwoXml(workout);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<workout_file>');
    expect(xml).toContain('<author>Watts Next (Adaptive Coach)</author>');
    expect(xml).toContain('<sportType>bike</sportType>');
    expect(xml).toContain('<tag name="Watts Next"/>');
    expect(xml).toContain('<warmup Duration=');
    expect(xml).toContain('<steadyState Duration=');
    expect(xml).toContain('<cooldown Duration=');
    expect(xml).toContain('</workout_file>');
  });

  it('correctly escapes XML characters in title and description', () => {
    const workout = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.sweetspot_3x12, 60, 200);
    workout.title = 'Test & "Special" <Workout>';
    const xml = generateZwoXml(workout);

    expect(xml).toContain('Test &amp; &quot;Special&quot; &lt;Workout&gt;');
  });

  it('includes cadence attribute when provided on workout steps', () => {
    const workout = scaleWorkoutToMinutes(WORKOUT_TEMPLATES.vo2max_40_20, 60, 250);
    const xml = generateZwoXml(workout);

    // VO2max steps typically recommend ~95-105 rpm
    expect(xml).toMatch(/Cadence="\d+"/);
  });
});
