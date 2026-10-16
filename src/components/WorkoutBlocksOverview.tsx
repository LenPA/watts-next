import { useState } from 'react';
import { Flame, Snowflake, Zap, Gauge } from 'lucide-react';
import type { ComputedWorkout, ComputedWorkoutStep } from '../lib/workoutLibrary';

interface WorkoutBlocksOverviewProps {
  workout: ComputedWorkout;
  compact?: boolean;
  maxHeight?: string;
}

export function getZoneInfo(targetPercent: number): { name: string; color: string; short: string; bg: string } {
  if (targetPercent < 0.56) {
    return { name: 'Actief Herstel', color: 'var(--color-zone-recovery)', short: 'Z1', bg: 'rgba(100, 116, 139, 0.15)' };
  }
  if (targetPercent < 0.76) {
    return { name: 'Duurvermogen', color: 'var(--color-zone-endurance)', short: 'Z2', bg: 'rgba(16, 185, 129, 0.15)' };
  }
  if (targetPercent < 0.88) {
    return { name: 'Tempo', color: 'var(--color-zone-tempo)', short: 'Z3', bg: 'rgba(14, 165, 233, 0.15)' };
  }
  if (targetPercent <= 0.94) {
    return { name: 'Sweet Spot', color: 'var(--color-zone-sweetspot)', short: 'SS', bg: 'rgba(249, 115, 22, 0.15)' };
  }
  if (targetPercent < 1.06) {
    return { name: 'Drempelvermogen', color: 'var(--color-zone-threshold)', short: 'Z4', bg: 'rgba(245, 158, 11, 0.15)' };
  }
  if (targetPercent < 1.21) {
    return { name: 'VO₂ Max', color: 'var(--color-zone-vo2max)', short: 'Z5', bg: 'rgba(239, 68, 68, 0.15)' };
  }
  return { name: 'Anaeroob / Sprint', color: '#a855f7', short: 'Z6', bg: 'rgba(168, 85, 247, 0.18)' };
}

interface GroupedPhase {
  id: 'warmup' | 'main' | 'cooldown';
  title: string;
  icon: typeof Flame;
  iconColor: string;
  totalDurationSeconds: number;
  steps: ComputedWorkoutStep[];
}

export default function WorkoutBlocksOverview({
  workout,
  compact = false,
  maxHeight = '260px'
}: WorkoutBlocksOverviewProps) {
  const [hoveredStepIndex, setHoveredStepIndex] = useState<number | null>(null);

  if (!workout || !workout.computedSteps || workout.computedSteps.length === 0) {
    return null;
  }

  const steps = workout.computedSteps;

  // Group steps logically into 3 phases: Warming-up, Kernblokken, Cooling-down
  const phases: GroupedPhase[] = [];
  const warmupSteps: ComputedWorkoutStep[] = [];
  const mainSteps: ComputedWorkoutStep[] = [];
  const cooldownSteps: ComputedWorkoutStep[] = [];

  let passedWarmup = false;
  steps.forEach((step, idx) => {
    if (step.type === 'warmup' && !passedWarmup) {
      warmupSteps.push(step);
    } else if (step.type === 'cooldown' && idx >= steps.length - 2) {
      cooldownSteps.push(step);
    } else {
      passedWarmup = true;
      mainSteps.push(step);
    }
  });

  // Fallback if all were labeled interval or all warmup
  if (mainSteps.length === 0 && steps.length > 0) {
    mainSteps.push(...steps);
  }

  if (warmupSteps.length > 0) {
    phases.push({
      id: 'warmup',
      title: 'Warming-up',
      icon: Flame,
      iconColor: 'var(--color-zone-threshold)',
      totalDurationSeconds: warmupSteps.reduce((acc, s) => acc + s.durationSeconds, 0),
      steps: warmupSteps
    });
  }

  if (mainSteps.length > 0) {
    phases.push({
      id: 'main',
      title: 'Kernblok',
      icon: Zap,
      iconColor: 'var(--color-primary)',
      totalDurationSeconds: mainSteps.reduce((acc, s) => acc + s.durationSeconds, 0),
      steps: mainSteps
    });
  }

  if (cooldownSteps.length > 0) {
    phases.push({
      id: 'cooldown',
      title: 'Cooling-down',
      icon: Snowflake,
      iconColor: 'var(--color-zone-tempo)',
      totalDurationSeconds: cooldownSteps.reduce((acc, s) => acc + s.durationSeconds, 0),
      steps: cooldownSteps
    });
  }

  const formatPhaseDuration = (totalSec: number) => {
    const mins = Math.round(totalSec / 60);
    return mins > 0 ? `${mins} min` : `${totalSec}s`;
  };

  return (
    <div 
      className="workout-blocks-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        marginTop: '0.5rem',
        marginBottom: '0.5rem',
        background: 'var(--color-surface-secondary)',
        border: '1px solid var(--border-soft)',
        borderRadius: '12px',
        padding: compact ? '0.75rem' : '0.9rem',
        position: 'relative'
      }}
    >
      {/* Visual Profile Bar Graph */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.75rem' }}>
          <span style={{ fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Zap size={13} style={{ color: 'var(--color-primary)' }} />
            Vermogensprofiel van de training
          </span>
          <span style={{ color: 'var(--text-muted)' }}>
            {workout.totalDurationFormatted} • {steps.length} blokken
          </span>
        </div>

        {/* The interactive bar chart */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            height: compact ? '48px' : '62px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderRadius: '8px',
            padding: '4px',
            gap: '2px',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}
        >
          {steps.map((step, idx) => {
            const zone = getZoneInfo(step.targetFtpPercent);
            // Map 40% - 130% FTP to 22% - 100% height
            const heightPercent = Math.min(100, Math.max(22, (step.targetFtpPercent / 1.3) * 100));
            const isHovered = hoveredStepIndex === idx;

            return (
              <div
                key={step.id || idx}
                onMouseEnter={() => setHoveredStepIndex(idx)}
                onMouseLeave={() => setHoveredStepIndex(null)}
                style={{
                  flex: Math.max(step.durationSeconds, 60),
                  height: `${heightPercent}%`,
                  backgroundColor: zone.color,
                  opacity: hoveredStepIndex === null ? 0.9 : (isHovered ? 1 : 0.4),
                  borderRadius: '3px 3px 1px 1px',
                  transition: 'opacity 0.15s ease, transform 0.15s ease',
                  transform: isHovered ? 'scaleY(1.05)' : 'none',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                title={`${step.name}: ${step.formattedDuration} @ ${step.targetWattsLow}${step.targetWattsHigh > step.targetWattsLow ? `-${step.targetWattsHigh}` : ''}W (${Math.round(step.targetFtpPercent * 100)}% FTP)${step.targetCadence ? ` • ${step.targetCadence} RPM` : ''}`}
              />
            );
          })}
        </div>

        {/* Hover detail tooltip bar */}
        {hoveredStepIndex !== null && steps[hoveredStepIndex] && (
          <div style={{
            marginTop: '0.35rem',
            padding: '0.35rem 0.6rem',
            background: 'var(--color-surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: '6px',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'fadeIn 0.15s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                backgroundColor: getZoneInfo(steps[hoveredStepIndex].targetFtpPercent).color 
              }} />
              <strong style={{ color: 'var(--color-text-primary)' }}>{steps[hoveredStepIndex].name}</strong>
              <span style={{ color: 'var(--text-muted)' }}>({steps[hoveredStepIndex].formattedDuration})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <span style={{ color: 'var(--color-primary)' }}>
                {steps[hoveredStepIndex].targetWattsHigh > steps[hoveredStepIndex].targetWattsLow
                  ? `${steps[hoveredStepIndex].targetWattsLow}-${steps[hoveredStepIndex].targetWattsHigh}W`
                  : `${steps[hoveredStepIndex].targetWattsLow}W`}
                {' '}({Math.round(steps[hoveredStepIndex].targetFtpPercent * 100)}% FTP)
              </span>
              {steps[hoveredStepIndex].targetCadence && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  🎯 {steps[hoveredStepIndex].targetCadence} RPM
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Structured Phase & Steps List (Warming-up, Kern, Cooling-down) */}
      <div 
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
          maxHeight: maxHeight,
          overflowY: 'auto',
          paddingRight: '0.2rem'
        }}
      >
        {phases.map((phase) => {
          const PhaseIcon = phase.icon;

          return (
            <div 
              key={phase.id}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--border-soft)',
                borderRadius: '9px',
                padding: '0.55rem 0.7rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem'
              }}
            >
              {/* Phase Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-soft)', paddingBottom: '0.3rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <PhaseIcon size={13} style={{ color: phase.iconColor }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                    {phase.title}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {formatPhaseDuration(phase.totalDurationSeconds)}
                </span>
              </div>

              {/* Steps inside this phase */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {phase.steps.map((step) => {
                  const stepGlobalIdx = steps.indexOf(step);
                  const zone = getZoneInfo(step.targetFtpPercent);
                  const isHovered = hoveredStepIndex === stepGlobalIdx;

                  return (
                    <div
                      key={step.id || stepGlobalIdx}
                      onMouseEnter={() => setHoveredStepIndex(stepGlobalIdx)}
                      onMouseLeave={() => setHoveredStepIndex(null)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.3rem 0.45rem',
                        borderRadius: '6px',
                        backgroundColor: isHovered ? 'var(--color-surface-secondary)' : 'transparent',
                        borderLeft: `3px solid ${zone.color}`,
                        transition: 'background-color 0.15s ease',
                        gap: '0.5rem'
                      }}
                    >
                      {/* Left: Step name & duration */}
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', minWidth: 0, flex: 1 }}>
                        <span style={{ 
                          fontSize: '0.78rem', 
                          fontWeight: 600, 
                          color: 'var(--color-text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {step.name}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                          • {step.formattedDuration}
                        </span>
                      </div>

                      {/* Right: Watts, % FTP, Cadans & Zone */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                        {/* Target Watts & % FTP */}
                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                            {step.targetWattsHigh > step.targetWattsLow 
                              ? `${step.targetWattsLow}-${step.targetWattsHigh}W` 
                              : `${step.targetWattsLow}W`}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            ({Math.round(step.targetFtpPercent * 100)}%)
                          </span>
                        </div>

                        {/* Cadence badge */}
                        {step.targetCadence && (
                          <span 
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: 'var(--text-muted)',
                              backgroundColor: 'var(--color-surface-secondary)',
                              border: '1px solid var(--border-soft)',
                              borderRadius: '4px',
                              padding: '0.1rem 0.35rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.2rem'
                            }}
                            title={`Aanbevolen trapfrequentie: ${step.targetCadence} RPM`}
                          >
                            <Gauge size={10} />
                            {step.targetCadence}
                          </span>
                        )}

                        {/* Zone Pill */}
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            padding: '0.1rem 0.35rem',
                            borderRadius: '4px',
                            backgroundColor: zone.bg,
                            color: zone.color,
                            border: `1px solid ${zone.color}30`
                          }}
                          title={zone.name}
                        >
                          {zone.short}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
