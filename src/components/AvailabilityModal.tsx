import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, Check, Calendar, RotateCcw } from 'lucide-react';
import type { AvailabilityRecord } from '../lib/db';
import { saveWeeklyAvailability, DEFAULT_WEEK_AVAILABILITY } from '../lib/db';

interface AvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSchedule: AvailabilityRecord[];
  onSaved: (newSchedule: AvailabilityRecord[]) => void;
  focusedDayOfWeek?: number | null;
}

const PRESET_MINUTES = [0, 30, 45, 60, 75, 90, 120, 180];

export default function AvailabilityModal({
  isOpen,
  onClose,
  currentSchedule,
  onSaved,
  focusedDayOfWeek
}: AvailabilityModalProps) {
  const [schedule, setSchedule] = useState<AvailabilityRecord[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (currentSchedule && currentSchedule.length === 7) {
        setSchedule(currentSchedule.map(s => ({ ...s })));
      } else {
        const defaults: AvailabilityRecord[] = DEFAULT_WEEK_AVAILABILITY.map(d => ({
          ...d,
          updated_at: Date.now()
        }));
        setSchedule(defaults);
      }
    }
  }, [isOpen, currentSchedule]);

  if (!isOpen) return null;

  const handleMinutesChange = (index: number, minutes: number) => {
    setSchedule(prev => {
      const next = [...prev];
      const cur = { ...next[index] };
      cur.minutes = minutes;
      if (minutes === 0) {
        cur.preference = 'rest';
      } else if (cur.preference === 'rest') {
        cur.preference = 'both';
      }
      next[index] = cur;
      return next;
    });
  };

  const handlePreferenceChange = (index: number, pref: 'indoor' | 'outdoor' | 'both' | 'rest') => {
    setSchedule(prev => {
      const next = [...prev];
      const cur = { ...next[index] };
      cur.preference = pref;
      if (pref === 'rest') {
        cur.minutes = 0;
      } else if (cur.minutes === 0) {
        cur.minutes = 60;
      }
      next[index] = cur;
      return next;
    });
  };

  const handleResetToDefaults = () => {
    const defaults: AvailabilityRecord[] = DEFAULT_WEEK_AVAILABILITY.map(d => ({
      ...d,
      updated_at: Date.now()
    }));
    setSchedule(defaults);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const saved = await saveWeeklyAvailability(schedule);
      onSaved(saved);
      onClose();
    } catch (e) {
      console.error('Failed to save availability schedule:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const totalMinutes = schedule.reduce((sum, s) => sum + (s.minutes || 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const trainingDaysCount = schedule.filter(s => (s.minutes || 0) > 0 && s.preference !== 'rest').length;
  const restDaysCount = 7 - trainingDaysCount;

  const modal = (
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
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--color-surface)',
          borderRadius: '16px',
          border: '1px solid var(--border-soft)',
          boxShadow: 'var(--shadow-lg)',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Calendar size={20} color="var(--accent-primary)" />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                Weekbeschikbaarheid Aanpassen
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.15rem 0 0 0' }}>
                De planning past zich direct automatisch aan op jouw gewijzigde trainingsuren.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content: 7 Days List */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Summary Box */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'rgba(249, 115, 22, 0.08)',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            borderRadius: '10px',
            padding: '0.75rem 1rem',
            fontSize: '0.85rem',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: 'var(--accent-primary)', fontWeight: 700 }}>
              <Clock size={16} />
              <span>Totaal gepland weekvolume: {totalHours} uur</span>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {trainingDaysCount} trainingsdagen • {restDaysCount} rustdagen
            </div>
          </div>

          {/* 7 Days Steppers */}
          {schedule.map((day, idx) => {
            const isRest = day.preference === 'rest' || day.minutes === 0;
            const isFocused = focusedDayOfWeek === idx;

            return (
              <div 
                key={idx}
                style={{
                  backgroundColor: isFocused ? 'rgba(249, 115, 22, 0.06)' : 'var(--color-surface-secondary)',
                  border: isFocused ? '1px solid var(--accent-primary)' : '1px solid var(--border-soft)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Left: Day Name */}
                <div style={{ minWidth: '100px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: isFocused ? 'var(--accent-primary)' : 'var(--color-text-primary)' }}>
                    {day.day_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: isRest ? 'var(--color-zone-recovery)' : 'var(--accent-secondary)', fontWeight: 600 }}>
                    {isRest ? 'Volledige rust' : `${day.minutes} minuten`}
                  </div>
                </div>

                {/* Middle: Quick Minute Presets */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {PRESET_MINUTES.map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => handleMinutesChange(idx, mins)}
                      style={{
                        padding: '0.25rem 0.55rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor: day.minutes === mins ? 'var(--accent-primary)' : 'var(--border-soft)',
                        backgroundColor: day.minutes === mins ? 'var(--accent-primary)' : 'transparent',
                        color: day.minutes === mins ? '#ffffff' : 'var(--text-muted)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {mins === 0 ? 'Rust' : `${mins}m`}
                    </button>
                  ))}
                </div>

                {/* Right: Preference pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  {[
                    { id: 'indoor', label: 'Binnen', icon: '🏠' },
                    { id: 'outdoor', label: 'Buiten', icon: '🌳' },
                    { id: 'both', label: 'Beide', icon: '🚴' }
                  ].map(p => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={isRest}
                      onClick={() => handlePreferenceChange(idx, p.id as 'indoor' | 'outdoor' | 'both')}
                      style={{
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        cursor: isRest ? 'not-allowed' : 'pointer',
                        opacity: isRest ? 0.35 : 1,
                        border: '1px solid',
                        borderColor: day.preference === p.id ? 'var(--accent-secondary)' : 'var(--border-soft)',
                        backgroundColor: day.preference === p.id ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                        color: day.preference === p.id ? 'var(--accent-secondary)' : 'var(--text-muted)',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {p.icon} {p.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
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
          <button
            type="button"
            onClick={handleResetToDefaults}
            className="btn-glass"
            style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}
          >
            <RotateCcw size={13} />
            <span>Standaardschema herstellen</span>
          </button>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-glass"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Annuleren
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn"
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: isSaving ? 'not-allowed' : 'pointer'
              }}
            >
              <Check size={16} />
              <span>{isSaving ? 'Opslaan...' : 'Opslaan & Plan Aanpassen'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
