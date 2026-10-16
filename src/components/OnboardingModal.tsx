import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Zap, 
  Heart, 
  Scale, 
  Award, 
  Check, 
  Sparkles,
  Info
} from 'lucide-react';
import { 
  getAthleteProfile, 
  saveAthleteProfile, 
  getActiveTrainingGoal, 
  saveTrainingGoal, 
  getWeeklyAvailability, 
  saveWeeklyAvailability,
  type AthleteProfileRecord,
  type TrainingGoalRecord,
  type AvailabilityRecord
} from '../lib/db';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (profile: AthleteProfileRecord) => void;
  initialFtp?: number;
}

export default function OnboardingModal({
  isOpen,
  onClose,
  onComplete,
  initialFtp = 250
}: OnboardingModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);

  // Step 1: Physiological Profile
  const [ftp, setFtp] = useState<number>(initialFtp);
  const [weight, setWeight] = useState<number>(75);
  const [maxHeartrate, setMaxHeartrate] = useState<number>(190);
  const [restingHeartrate, setRestingHeartrate] = useState<number | ''>(55);
  const [experienceLevel, setExperienceLevel] = useState<AthleteProfileRecord['experience_level']>('intermediate');

  // Step 2: Training Goal
  const [goalType, setGoalType] = useState<TrainingGoalRecord['type']>('ftp_increase');
  const [goalTitle, setGoalTitle] = useState<string>('FTP Drempelverhoging');
  const [targetDate, setTargetDate] = useState<string>('');
  const [targetFtp, setTargetFtp] = useState<number>(initialFtp + 15);
  const [targetHours, setTargetHours] = useState<number>(7);

  // Step 3: Availability
  const [availability, setAvailability] = useState<AvailabilityRecord[]>([]);

  // Load existing profile, goal, and availability on mount
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    (async () => {
      try {
        const existingProfile = await getAthleteProfile();
        if (existingProfile && isMounted) {
          setFtp(existingProfile.ftp);
          setWeight(existingProfile.weight);
          setMaxHeartrate(existingProfile.max_heartrate);
          setRestingHeartrate(existingProfile.resting_heartrate ?? '');
          setExperienceLevel(existingProfile.experience_level);
        } else if (initialFtp && isMounted) {
          setFtp(initialFtp);
        }

        const existingGoal = await getActiveTrainingGoal();
        if (existingGoal && isMounted) {
          setGoalType(existingGoal.type);
          setGoalTitle(existingGoal.title);
          setTargetDate(existingGoal.target_date || '');
          if (existingGoal.target_ftp) setTargetFtp(existingGoal.target_ftp);
          if (existingGoal.target_hours_per_week) setTargetHours(existingGoal.target_hours_per_week);
        }

        const schedule = await getWeeklyAvailability();
        if (isMounted) {
          setAvailability(schedule);
        }
      } catch (err) {
        console.error('Failed to load profile data:', err);
      }
    })();

    return () => { isMounted = false; };
  }, [isOpen, initialFtp]);

  if (!isOpen) return null;

  const handleGoalTypeSelect = (type: TrainingGoalRecord['type']) => {
    setGoalType(type);
    switch (type) {
      case 'ftp_increase':
        setGoalTitle('FTP Drempelverhoging');
        setTargetFtp(Math.round(ftp * 1.06));
        break;
      case 'gran_fondo':
        setGoalTitle('Gran Fondo / Toertocht Voorbereiding');
        break;
      case 'endurance_base':
        setGoalTitle('Aerobe Basis & Duurvermogen');
        break;
      case 'racing':
        setGoalTitle('Criterium & Wedstrijdvorm');
        break;
      case 'general_fitness':
        setGoalTitle('Algemene Conditie & Gezondheid');
        break;
    }
  };

  const updateDayAvailability = (index: number, field: keyof AvailabilityRecord, value: unknown) => {
    setAvailability(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleFinish = async () => {
    try {
      setSaving(true);

      // 1. Save Athlete Profile & update FTP history
      const savedProfile = await saveAthleteProfile({
        ftp: Math.max(50, Math.min(600, ftp)),
        weight: Math.max(40, Math.min(200, weight)),
        max_heartrate: Math.max(120, Math.min(230, maxHeartrate)),
        resting_heartrate: restingHeartrate ? Number(restingHeartrate) : undefined,
        experience_level: experienceLevel,
        created_at: Date.now()
      });

      // Also persist to localStorage for instant UI reactivity
      localStorage.setItem('strava_user_ftp', String(savedProfile.ftp));

      // 2. Save Active Training Goal
      await saveTrainingGoal({
        type: goalType,
        title: goalTitle,
        target_date: targetDate || undefined,
        target_ftp: goalType === 'ftp_increase' ? targetFtp : undefined,
        target_hours_per_week: targetHours,
        active: true
      });

      // 3. Save Weekly Availability
      if (availability.length > 0) {
        await saveWeeklyAvailability(availability);
      }

      onComplete(savedProfile);
      onClose();
    } catch (err) {
      console.error('Failed to save onboarding data:', err);
      alert('Er is een fout opgetreden bij het opslaan van je profiel.');
    } finally {
      setSaving(false);
    }
  };

  const wkg = (ftp / (weight || 1)).toFixed(2);

  const modalContent = (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '1rem',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '1.25rem',
        border: '1px solid var(--color-border)',
        width: '100%',
        maxWidth: '38rem',
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: 'var(--color-text-main)'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--color-surface)',
          zIndex: 10
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} style={{ color: 'var(--color-primary)' }} />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>
                {step === 1 && 'Fysiologisch Atleetprofiel'}
                {step === 2 && 'Jouw Trainingsdoel'}
                {step === 3 && 'Weekbeschikbaarheid'}
              </h2>
            </div>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              Stap {step} van 3 • Watts Next gebruikt dit voor gepersonaliseerde analyse
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Sluiten"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Indicator */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 1.5rem 0',
          backgroundColor: 'var(--color-surface)'
        }}>
          {[1, 2, 3].map(s => (
            <div
              key={s}
              style={{
                flex: 1,
                height: '4px',
                borderRadius: '2px',
                backgroundColor: s <= step ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                transition: 'background-color 0.25s ease'
              }}
            />
          ))}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', flex: 1 }}>
          {/* STEP 1: Physiological Profile */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* FTP & W/kg Preview Banner */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 107, 0, 0.12), rgba(255, 107, 0, 0.04))',
                border: '1px solid rgba(255, 107, 0, 0.3)',
                borderRadius: '0.875rem',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-primary)' }}>
                    Berekende Kracht/Gewicht Ratio
                  </span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: '0.1rem' }}>
                    {wkg} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>W/kg</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Zone 2 Duurvermogen</span>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--color-zone-endurance)' }}>
                    {Math.round(ftp * 0.55)} - {Math.round(ftp * 0.75)} W
                  </div>
                </div>
              </div>

              {/* Grid Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* FTP Input */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    <Zap size={15} style={{ color: 'var(--color-primary)' }} /> Actuele FTP (Watts)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={600}
                    value={ftp}
                    onChange={(e) => setFtp(Number(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface-hover)',
                      color: 'var(--color-text-main)',
                      fontSize: '1rem',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Vermogen dat je ~40-60 min volhoudt</span>
                </div>

                {/* Weight Input */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    <Scale size={15} style={{ color: 'var(--color-primary)' }} /> Lichaamsgewicht (kg)
                  </label>
                  <input
                    type="number"
                    min={40}
                    max={200}
                    step={0.5}
                    value={weight}
                    onChange={(e) => setWeight(Number(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface-hover)',
                      color: 'var(--color-text-main)',
                      fontSize: '1rem',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Nodig voor W/kg berekening</span>
                </div>

                {/* Max Heartrate */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    <Heart size={15} style={{ color: '#ef4444' }} /> Maximale Hartslag (BPM)
                  </label>
                  <input
                    type="number"
                    min={120}
                    max={230}
                    value={maxHeartrate}
                    onChange={(e) => setMaxHeartrate(Number(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface-hover)',
                      color: 'var(--color-text-main)',
                      fontSize: '1rem',
                      fontWeight: 600,
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Voor hrTSS zonder vermogensmeter</span>
                </div>

                {/* Resting Heartrate */}
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>
                    <Heart size={15} style={{ color: 'var(--color-text-muted)' }} /> Rusthartslag (Optioneel)
                  </label>
                  <input
                    type="number"
                    min={30}
                    max={100}
                    value={restingHeartrate}
                    onChange={(e) => setRestingHeartrate(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="bijv. 50"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface-hover)',
                      color: 'var(--color-text-main)',
                      fontSize: '1rem',
                      outline: 'none'
                    }}
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Indicatie van herstel & fitheid</span>
                </div>
              </div>

              {/* Experience Level */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  <Award size={15} style={{ color: 'var(--color-primary)' }} /> Ervaringsniveau
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {[
                    { id: 'beginner', label: 'Beginner', desc: '< 1 jaar' },
                    { id: 'intermediate', label: 'Recreant', desc: '1-3 jaar' },
                    { id: 'advanced', label: 'Gevorderd', desc: '3-6 jaar' },
                    { id: 'competitive', label: 'Licentie', desc: 'Koers/Gran Fondo' }
                  ].map(lvl => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setExperienceLevel(lvl.id as AthleteProfileRecord['experience_level'])}
                      style={{
                        padding: '0.6rem 0.4rem',
                        borderRadius: '0.5rem',
                        border: experienceLevel === lvl.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        backgroundColor: experienceLevel === lvl.id ? 'rgba(255, 107, 0, 0.1)' : 'var(--color-surface-hover)',
                        color: 'var(--color-text-main)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{lvl.label}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{lvl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Training Goals */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>
                  Kies je primaire hoofddoel:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  {[
                    {
                      id: 'ftp_increase',
                      title: 'FTP Drempelverhoging',
                      desc: 'Focus op Sweet Spot en over-under intervallen om je wattages te verhogen.'
                    },
                    {
                      id: 'gran_fondo',
                      title: 'Gran Fondo / Toertocht',
                      desc: 'Lange duurritten, klimtempo en uithoudingsvermogen voor cyclo events.'
                    },
                    {
                      id: 'endurance_base',
                      title: 'Duurbasis (Zone 2)',
                      desc: 'Verbetering van vetverbranding en aerobe efficiëntie met lage intensiteit.'
                    },
                    {
                      id: 'racing',
                      title: 'Wedstrijden & Criteriums',
                      desc: 'VO2 Max 40/20s, anaerobe capaciteit en herhaaldelijk herstel na harde surges.'
                    },
                    {
                      id: 'general_fitness',
                      title: 'Algemene Conditie',
                      desc: 'Gebalanceerde mix van ritten voor plezier, gezondheid en ontspanning.'
                    }
                  ].map(g => (
                    <div
                      key={g.id}
                      onClick={() => handleGoalTypeSelect(g.id as TrainingGoalRecord['type'])}
                      style={{
                        padding: '1rem',
                        borderRadius: '0.75rem',
                        border: goalType === g.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        backgroundColor: goalType === g.id ? 'rgba(255, 107, 0, 0.08)' : 'var(--color-surface-hover)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                          {g.title}
                        </span>
                        {goalType === g.id && (
                          <div style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff'
                          }}>
                            <Check size={12} strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.3 }}>
                        {g.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Specific Goal Targets */}
              <div style={{
                backgroundColor: 'var(--color-surface-hover)',
                borderRadius: '0.75rem',
                padding: '1rem',
                border: '1px solid var(--color-border)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1rem'
              }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block' }}>
                    Naam of titel van doel
                  </label>
                  <input
                    type="text"
                    value={goalTitle}
                    onChange={(e) => setGoalTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text-main)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block' }}>
                    Streefdatum (optioneel)
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text-main)',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                {goalType === 'ftp_increase' && (
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block' }}>
                      Streef-FTP (Watts)
                    </label>
                    <input
                      type="number"
                      value={targetFtp}
                      onChange={(e) => setTargetFtp(Number(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-main)',
                        fontSize: '0.9rem',
                        fontWeight: 600
                      }}
                    />
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block' }}>
                    Gewenste trainingsuren per week
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={30}
                    value={targetHours}
                    onChange={(e) => setTargetHours(Number(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-surface)',
                      color: 'var(--color-text-main)',
                      fontSize: '0.9rem',
                      fontWeight: 600
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Weekly Availability */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: '0.5rem',
                padding: '0.75rem',
                fontSize: '0.8rem',
                color: 'var(--color-text-main)'
              }}>
                <Info size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />
                <span>
                  Geef per weekdag aan hoeveel minuten je maximaal kunt fietsen en of je voorkeur uitgaat naar indoor (Zwift) of buiten.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {availability.map((day, idx) => (
                  <div
                    key={day.day_name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 1rem',
                      borderRadius: '0.625rem',
                      backgroundColor: 'var(--color-surface-hover)',
                      border: '1px solid var(--color-border)'
                    }}
                  >
                    <div style={{ width: '6.5rem', fontWeight: 700, fontSize: '0.85rem' }}>
                      {day.day_name}
                    </div>

                    {/* Minutes selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        type="number"
                        step={15}
                        min={0}
                        max={480}
                        value={day.minutes}
                        onChange={(e) => updateDayAvailability(idx, 'minutes', Number(e.target.value) || 0)}
                        style={{
                          width: '4.5rem',
                          padding: '0.4rem 0.5rem',
                          borderRadius: '0.375rem',
                          border: '1px solid var(--color-border)',
                          backgroundColor: 'var(--color-surface)',
                          color: 'var(--color-text-main)',
                          fontSize: '0.85rem',
                          textAlign: 'center',
                          fontWeight: 600
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>min</span>
                    </div>

                    {/* Preference buttons */}
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {[
                        { id: 'rest', label: 'Rust' },
                        { id: 'indoor', label: 'Indoor' },
                        { id: 'outdoor', label: 'Buiten' },
                        { id: 'both', label: 'Beide' }
                      ].map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            updateDayAvailability(idx, 'preference', p.id);
                            if (p.id === 'rest') updateDayAvailability(idx, 'minutes', 0);
                            else if (day.minutes === 0) updateDayAvailability(idx, 'minutes', 60);
                          }}
                          style={{
                            padding: '0.35rem 0.6rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderRadius: '0.375rem',
                            border: day.preference === p.id ? '1px solid var(--color-primary)' : '1px solid transparent',
                            backgroundColor: day.preference === p.id ? 'rgba(255, 107, 0, 0.15)' : 'transparent',
                            color: day.preference === p.id ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            cursor: 'pointer'
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total planned availability */}
              <div style={{
                textAlign: 'right',
                fontSize: '0.8rem',
                color: 'var(--color-text-muted)',
                marginTop: '0.25rem'
              }}>
                Totale weekbeschikbaarheid:{' '}
                <strong style={{ color: 'var(--color-text-main)' }}>
                  {(availability.reduce((sum, d) => sum + (d.minutes || 0), 0) / 60).toFixed(1)} uur
                </strong>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--color-surface)',
          position: 'sticky',
          bottom: 0,
          zIndex: 10
        }}>
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.6rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid var(--color-border)',
                backgroundColor: 'transparent',
                color: 'var(--color-text-main)',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={16} /> Vorige
            </button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.65rem 1.25rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255, 107, 0, 0.3)'
              }}
            >
              Volgende <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={handleFinish}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.65rem 1.5rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(255, 107, 0, 0.3)'
              }}
            >
              {saving ? 'Opslaan...' : 'Opslaan & Analyseren'} <Check size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
