import { useState, useRef, useId } from 'react';
import type { ComputedWorkout, ComputedWorkoutStep } from '../lib/workoutLibrary';
import { getZoneInfo } from './WorkoutBlocksOverview';
import { Clock, Zap, Flame, Activity } from 'lucide-react';

interface WorkoutPowerProfileProps {
  workout: ComputedWorkout;
  ftp?: number;
  height?: number; // approx 160-200px
  onClick?: () => void;
  className?: string;
}

export default function WorkoutPowerProfile({
  workout,
  ftp = 250,
  height = 180,
  onClick,
  className = ''
}: WorkoutPowerProfileProps) {
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  if (!workout || !workout.computedSteps || workout.computedSteps.length === 0) {
    return null;
  }

  const steps = workout.computedSteps;
  const totalSeconds = steps.reduce((acc, s) => acc + s.durationSeconds, 0);
  const maxStepWatts = Math.max(...steps.map(s => s.targetWattsHigh || s.targetWattsLow), ftp * 1.15);
  const yAxisMaxWatts = Math.ceil((maxStepWatts * 1.15) / 50) * 50; // rounded up to nearest 50W

  // SVG dimensions (viewBox coordinates)
  const svgWidth = 800;
  const svgHeight = height;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 25;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  // Generate Y-axis gridlines (e.g. 0, FTP, max)
  const yGridTicks = [
    Math.round(yAxisMaxWatts * 0.33),
    ftp,
    Math.round(yAxisMaxWatts * 0.85)
  ].filter(w => w > 0 && w < yAxisMaxWatts);

  // Generate X-axis time marks
  const totalMinutes = Math.round(totalSeconds / 60);
  const xGridIntervalMin = totalMinutes > 90 ? 30 : (totalMinutes > 45 ? 15 : 10);
  const xGridTicks: number[] = [];
  for (let m = xGridIntervalMin; m < totalMinutes; m += xGridIntervalMin) {
    xGridTicks.push(m);
  }

  let accumulatedSeconds = 0;

  const activeStep: ComputedWorkoutStep | null = activeStepIndex !== null ? steps[activeStepIndex] : null;
  const activeZone = activeStep ? getZoneInfo(activeStep.targetFtpPercent) : null;

  return (
    <div 
      className={`workout-power-profile-card ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
        backgroundColor: 'var(--color-surface)',
        borderRadius: '12px',
        border: '1px solid var(--border-soft)',
        padding: '0.85rem 1rem',
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Summary Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              padding: '0.15rem 0.45rem',
              borderRadius: '4px',
              backgroundColor: 'rgba(252, 76, 2, 0.15)',
              color: 'var(--color-primary)'
            }}>
              {workout.targetZone || 'Gestructureerd'}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {steps.length} blokken
            </span>
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--color-text-primary)' }}>
            {workout.title}
          </h3>
        </div>

        {/* Key Metrics Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-primary)',
            backgroundColor: 'var(--color-surface-secondary)',
            border: '1px solid var(--border-soft)',
            padding: '0.2rem 0.5rem',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}>
            <Clock size={12} style={{ color: 'var(--text-muted)' }} />
            {workout.totalDurationFormatted}
          </span>

          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--accent-secondary)',
            backgroundColor: 'var(--color-surface-secondary)',
            border: '1px solid var(--border-soft)',
            padding: '0.2rem 0.5rem',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}>
            <Flame size={12} />
            {workout.estimatedTss} TSS
          </span>

          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--color-primary)',
            backgroundColor: 'var(--color-surface-secondary)',
            border: '1px solid var(--border-soft)',
            padding: '0.2rem 0.5rem',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}>
            <Zap size={12} />
            IF {(workout.intensityFactor || 0.8).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Primary Visual: Responsive SVG Workout Power Profile */}
      <div 
        ref={containerRef}
        style={{
          width: '100%',
          height: `${height}px`,
          position: 'relative',
          userSelect: 'none',
          backgroundColor: 'rgba(0, 0, 0, 0.25)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          overflow: 'hidden'
        }}
      >
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <defs>
            {/* Zone Gradients */}
            {steps.map((step, idx) => {
              const zone = getZoneInfo(step.targetFtpPercent);
              return (
                <linearGradient key={`grad-${idx}`} id={`${uid}-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={zone.color} stopOpacity="0.95" />
                  <stop offset="100%" stopColor={zone.color} stopOpacity="0.75" />
                </linearGradient>
              );
            })}
          </defs>

          {/* Background Grid: Y-Axis Lines (Watts) */}
          {yGridTicks.map((watts) => {
            const y = paddingTop + chartHeight - (watts / yAxisMaxWatts) * chartHeight;
            const isFtp = Math.abs(watts - ftp) < 2;
            return (
              <g key={`y-${watts}`}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={svgWidth - paddingRight}
                  y2={y}
                  stroke={isFtp ? 'var(--accent-secondary)' : 'rgba(255, 255, 255, 0.1)'}
                  strokeDasharray={isFtp ? '4,4' : undefined}
                  strokeWidth={isFtp ? 1.5 : 1}
                />
                <text
                  x={paddingLeft - 6}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill={isFtp ? 'var(--accent-secondary)' : 'var(--text-muted)'}
                  fontWeight={isFtp ? '700' : '500'}
                >
                  {isFtp ? `FTP ${watts}W` : `${watts}W`}
                </text>
              </g>
            );
          })}

          {/* Background Grid: X-Axis Lines (Time) */}
          {xGridTicks.map((min) => {
            const sec = min * 60;
            const x = paddingLeft + (sec / totalSeconds) * chartWidth;
            return (
              <g key={`x-${min}`}>
                <line
                  x1={x}
                  y1={paddingTop}
                  x2={x}
                  y2={paddingTop + chartHeight}
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeDasharray="2,4"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={svgHeight - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--text-muted)"
                >
                  {min}m
                </text>
              </g>
            );
          })}

          {/* Individual Interval Workout Blocks */}
          {steps.map((step, idx) => {
            const stepWatts = step.targetWattsHigh || step.targetWattsLow;
            const stepX = paddingLeft + (accumulatedSeconds / totalSeconds) * chartWidth;
            const stepW = Math.max(2, (step.durationSeconds / totalSeconds) * chartWidth);
            const stepH = Math.max(6, (stepWatts / yAxisMaxWatts) * chartHeight);
            const stepY = paddingTop + chartHeight - stepH;

            accumulatedSeconds += step.durationSeconds;
            const isHovered = activeStepIndex === idx;

            return (
              <g
                key={step.id || idx}
                onMouseEnter={(e) => {
                  e.stopPropagation();
                  setActiveStepIndex(idx);
                }}
                onMouseLeave={(e) => {
                  e.stopPropagation();
                  setActiveStepIndex(null);
                }}
                onClick={(e) => {
                  // Allow tap to toggle on mobile without triggering card click immediately
                  e.stopPropagation();
                  setActiveStepIndex(prev => prev === idx ? null : idx);
                }}
                style={{ cursor: 'pointer' }}
              >
                {/* Interval Bar */}
                <rect
                  x={stepX}
                  y={stepY}
                  width={stepW}
                  height={stepH}
                  rx="2"
                  ry="2"
                  fill={`url(#${uid}-grad-${idx})`}
                  opacity={activeStepIndex === null ? 0.9 : (isHovered ? 1 : 0.45)}
                  stroke={isHovered ? '#ffffff' : 'rgba(0, 0, 0, 0.3)'}
                  strokeWidth={isHovered ? 1.5 : 0.5}
                  style={{ transition: 'opacity 0.15s ease, filter 0.15s ease' }}
                />

                {/* Subtle Cadence Indicator on high-rpm intervals */}
                {step.targetCadence && step.targetCadence >= 100 && stepW > 25 && (
                  <circle
                    cx={stepX + stepW / 2}
                    cy={stepY + 6}
                    r="2"
                    fill="#ffffff"
                    opacity="0.7"
                  />
                )}
              </g>
            );
          })}

          {/* Baseline (0W) */}
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight}
            x2={svgWidth - paddingRight}
            y2={paddingTop + chartHeight}
            stroke="var(--border-soft)"
            strokeWidth="1.5"
          />
        </svg>

        {/* Hover / Tap Micro-Tooltip */}
        {activeStep && activeZone && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              backgroundColor: 'var(--color-surface)',
              border: `1px solid ${activeZone.color}`,
              borderRadius: '8px',
              padding: '0.4rem 0.65rem',
              boxShadow: '0 8px 20px rgba(0,0,0,0.4)',
              fontSize: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              zIndex: 10,
              pointerEvents: 'none',
              animation: 'fadeIn 0.15s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: activeZone.color }} />
              <strong style={{ color: 'var(--color-text-primary)' }}>{activeStep.name}</strong>
              <span style={{ color: 'var(--text-muted)' }}>({activeStep.formattedDuration})</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}>
              <span style={{ color: 'var(--color-primary)' }}>
                {activeStep.targetWattsHigh > activeStep.targetWattsLow
                  ? `${activeStep.targetWattsLow}-${activeStep.targetWattsHigh}W`
                  : `${activeStep.targetWattsLow}W`}
                {' '}({Math.round(activeStep.targetFtpPercent * 100)}%)
              </span>

              {activeStep.targetCadence && (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                  🎯 {activeStep.targetCadence} RPM
                </span>
              )}

              <span style={{
                fontSize: '0.65rem',
                padding: '0.1rem 0.35rem',
                borderRadius: '4px',
                backgroundColor: activeZone.bg,
                color: activeZone.color
              }}>
                {activeZone.short}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Activity size={12} style={{ color: 'var(--color-primary)' }} />
          Beweeg over of tik op een blok voor intervaldetails
        </span>
        {onClick && (
          <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Bekijk volledige training →
          </span>
        )}
      </div>
    </div>
  );
}
