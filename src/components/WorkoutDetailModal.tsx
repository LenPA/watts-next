import { createPortal } from 'react-dom';
import { 
  X, 
  Zap, 
  Clock, 
  Flame, 
  Activity, 
  CheckCircle2, 
  HelpCircle,
  BarChart3,
  Download
} from 'lucide-react';
import type { PlannedWeekDay } from '../lib/trainingPlanner';
import { downloadZwoFile } from '../lib/zwiftExport';

interface WorkoutDetailModalProps {
  day: PlannedWeekDay | null;
  onClose: () => void;
  onEditAvailability?: () => void;
  onSelectWorkout?: (dateKey: string, templateId: string) => void;
}

export default function WorkoutDetailModal({
  day,
  onClose,
  onEditAvailability,
  onSelectWorkout
}: WorkoutDetailModalProps) {
  if (!day) return null;

  const { workout, plannedReason, isCompleted, completedActivities } = day;
  const isRest = day.plannedCategory === 'rest';

  // Zone colors for steps
  const getStepColor = (targetPercent: number) => {
    if (targetPercent < 0.56) return 'var(--color-zone-recovery)'; // Z1
    if (targetPercent < 0.76) return 'var(--color-zone-endurance)'; // Z2
    if (targetPercent < 0.91) return 'var(--color-zone-tempo)'; // Z3
    if (targetPercent < 1.06) return 'var(--color-zone-threshold)'; // Z4
    if (targetPercent < 1.21) return 'var(--color-zone-vo2max)'; // Z5
    return 'var(--color-zone-anaerobic)'; // Z6
  };

  const modalContent = (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="card"
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          border: '1px solid var(--border-soft)',
          boxShadow: 'var(--shadow-elevation-high)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border-soft)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-surface-secondary)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                background: isRest ? 'rgba(148, 163, 184, 0.2)' : 'rgba(252, 76, 2, 0.15)',
                color: isRest ? 'var(--text-muted)' : 'var(--color-primary)'
              }}>
                {day.dayName} {day.dayNumber} {day.monthName}
              </span>
              {day.isToday && (
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  background: 'var(--color-primary)',
                  color: 'white'
                }}>
                  Vandaag
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--color-text-primary)' }}>
              {day.plannedTitle}
            </h2>
          </div>

          <button 
            onClick={onClose}
            className="btn-glass"
            style={{ padding: '0.4rem', borderRadius: '50%', cursor: 'pointer', border: 'none' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Workout Switcher Controls */}
          {onSelectWorkout && (
            <div style={{
              background: 'var(--color-surface-secondary)',
              border: '1px solid var(--border-soft)',
              borderRadius: '12px',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={16} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Kies training voor deze dag:
                </span>
              </div>

              <select
                value={workout.id}
                onChange={(e) => onSelectWorkout(day.dateKey, e.target.value)}
                style={{
                  background: 'var(--color-surface)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--border-soft)',
                  borderRadius: '8px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="vo2max_40_20">⚡️ VO₂ Max 40/20 Intervallen (60m)</option>
                <option value="vo2max_classic">⚡️ VO₂ Max 5×3m Blokken (60m)</option>
                <option value="sweetspot_3x12">🎯 Sweet Spot Blokken 3×12m (65m)</option>
                <option value="threshold_2x20">⚡️ Drempel Intervallen 2×20m (75m)</option>
                <option value="tempo_cadence">⏱ Tempo Z3 Cadanswissels (75m)</option>
                <option value="endurance_60">🚴 Aerobe Basis Duurtraining (60m)</option>
                <option value="endurance_90">🚴 Zone 2 Duurrit (90m)</option>
                <option value="endurance_long">🚴 Lange Duurrit (180m)</option>
                <option value="recovery_spin">☕️ Actief Herstel / Losrijden (45m)</option>
                <option value="rest">🛌 Volledige Rustdag (0m)</option>
              </select>
            </div>
          )}

          {/* Motivation / Why Box */}
          <div style={{
            background: 'var(--color-surface-secondary)',
            border: '1px solid var(--border-soft)',
            borderRadius: '12px',
            padding: '1rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start'
          }}>
            <HelpCircle size={18} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                Fysiologische motivatie & planning
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>
                {plannedReason}
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          {!isRest && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.75rem'
            }}>
              <div style={{ background: 'var(--color-surface-secondary)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  <Clock size={13} /> Duur
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {day.plannedDuration}
                </div>
              </div>

              <div style={{ background: 'var(--color-surface-secondary)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  <Zap size={13} /> Vermogen
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                  {day.plannedWatts}
                </div>
              </div>

              <div style={{ background: 'var(--color-surface-secondary)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  <Flame size={13} /> Verwachte TSS
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {day.plannedTss}
                </div>
              </div>

              <div style={{ background: 'var(--color-surface-secondary)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                  <Activity size={13} /> Type
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                  {day.preference === 'indoor' ? 'Indoor' : (day.preference === 'outdoor' ? 'Buiten' : 'Flexibel')}
                </div>
              </div>
            </div>
          )}

          {/* Structured Step Timeline Visualization */}
          {!isRest && workout.computedSteps.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <BarChart3 size={15} style={{ color: 'var(--color-primary)' }} />
                  Visueel Profiel van de Training
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {workout.computedSteps.length} trainingsblokken
                </span>
              </div>

              {/* Bar graph representing step intensities */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                height: '70px',
                background: 'var(--color-surface-secondary)',
                borderRadius: '8px',
                padding: '6px',
                gap: '3px',
                overflow: 'hidden'
              }}>
                {workout.computedSteps.map((step, idx) => {
                  const heightPercent = Math.min(100, Math.max(25, (step.targetFtpPercent / 1.3) * 100));
                  return (
                    <div
                      key={step.id || idx}
                      title={`${step.name}: ${step.formattedDuration} @ ${step.targetWattsLow}W (${Math.round(step.targetFtpPercent * 100)}% FTP)`}
                      style={{
                        flex: step.durationSeconds,
                        height: `${heightPercent}%`,
                        backgroundColor: getStepColor(step.targetFtpPercent),
                        borderRadius: '3px',
                        transition: 'opacity 0.2s',
                        cursor: 'pointer'
                      }}
                    />
                  );
                })}
              </div>

              {/* Step By Step Table */}
              <div style={{ marginTop: '1rem', border: '1px solid var(--border-soft)', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-secondary)', textAlign: 'left', borderBottom: '1px solid var(--border-soft)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '0.6rem 0.85rem' }}>Blok</th>
                      <th style={{ padding: '0.6rem 0.85rem' }}>Duur</th>
                      <th style={{ padding: '0.6rem 0.85rem' }}>Streefvermogen</th>
                      <th style={{ padding: '0.6rem 0.85rem' }}>Cadans</th>
                      <th style={{ padding: '0.6rem 0.85rem' }}>Doel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workout.computedSteps.map((step, idx) => (
                      <tr 
                        key={step.id || idx}
                        style={{ borderBottom: idx < workout.computedSteps.length - 1 ? '1px solid var(--border-soft)' : 'none' }}
                      >
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          <span style={{ 
                            display: 'inline-block', 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: getStepColor(step.targetFtpPercent), 
                            marginRight: '6px' 
                          }} />
                          {step.name}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)' }}>
                          {step.formattedDuration}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {step.targetWattsHigh > step.targetWattsLow 
                            ? `${step.targetWattsLow} - ${step.targetWattsHigh} W` 
                            : `${step.targetWattsLow} W`}
                          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '4px' }}>
                            ({Math.round(step.targetFtpPercent * 100)}%)
                          </span>
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)' }}>
                          {step.targetCadence ? `${step.targetCadence} RPM` : '-'}
                        </td>
                        <td style={{ padding: '0.65rem 0.85rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {step.description || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Completed Activity in Strava */}
          {isCompleted && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-zone-endurance)', fontWeight: 700, fontSize: '0.85rem' }}>
                <CheckCircle2 size={16} />
                <span>Gereden Activiteiten op Strava</span>
              </div>
              {completedActivities.map(act => {
                const anyA = act as unknown as Record<string, unknown>;
                const actLoad = typeof anyA.tss === 'number' ? anyA.tss : (typeof anyA.analyzedLoad === 'number' ? anyA.analyzedLoad : (typeof act.suffer_score === 'number' ? act.suffer_score : 0));
                return (
                  <div key={act.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{act.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {((act.distance || 0) / 1000).toFixed(1)} km • {Math.round((act.moving_time || 0) / 60)} min{actLoad > 0 ? ` • ${Math.round(actLoad)} TSS` : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-soft)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-surface-secondary)'
        }}>
          {onEditAvailability ? (
            <button
              onClick={() => {
                onClose();
                onEditAvailability();
              }}
              className="btn-glass"
              style={{ fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Pas beschikbaarheid aan
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
            {!isRest && workout.computedSteps.length > 0 && (
              <button
                onClick={() => downloadZwoFile(workout)}
                className="btn"
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  cursor: 'pointer',
                  background: 'linear-gradient(135deg, #fc5200 0%, #ea580c 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600
                }}
                title="Download dit gestructureerde trainingsbestand (.zwo) direct voor Zwift"
              >
                <Download size={15} /> Download .zwo voor Zwift
              </button>
            )}

            <button
              onClick={onClose}
              className="btn-glass"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Sluiten
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
