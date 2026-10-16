import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { getStravaAuthUrl, syncActivities, fetchActivityStreams, getAthlete } from '../api/strava';
import { 
  getAllActivities, 
  getLastSyncTime, 
  clearAllLocalData, 
  getAthleteProfile, 
  getActiveTrainingGoal,
  getWeeklyAvailability,
  type AthleteProfileRecord, 
  type TrainingGoalRecord,
  type AvailabilityRecord,
  type NormalizedActivity 
} from '../lib/db';
import { analyzeActivities, type AnalyzedData } from '../lib/analysis';
import { DEMO_ATHLETE, generateDemoActivities } from '../lib/demoData';
import { calculateFitnessTrends } from '../lib/physiology';
import { generateWeekPlan, type PlannedWeekDay } from '../lib/trainingPlanner';
import ThemeSwitcher from './ThemeSwitcher';
import FitnessFormChart from './FitnessFormChart';
import OnboardingModal from './OnboardingModal';
import ActivityDetailModal from './ActivityDetailModal';
import WorkoutDetailModal from './WorkoutDetailModal';
import AdaptiveReplanBanner from './AdaptiveReplanBanner';
import DataManagementModal from './DataManagementModal';
import { generateAdaptiveReplanProposal, acceptProposal, declineProposal } from '../lib/adaptiveCoach';
import { downloadZwoFile } from '../lib/zwiftExport';
import { 
  Activity, 
  Zap, 
  RefreshCw, 
  Calendar, 
  ArrowLeft, 
  Trash2, 
  Database, 
  CheckCircle2, 
  ShieldAlert, 
  Cpu, 
  Radio, 
  Clock, 
  Bike, 
  Sparkles, 
  Search, 
  Check, 
  User,
  ChevronDown,
  ChevronUp,
  Download
} from 'lucide-react';

export interface AthleteProfile {
  firstname?: string;
  lastname?: string;
  id?: number;
  [key: string]: unknown;
}

export default function Dashboard({ 
  token, 
  isDemo = false, 
  onLogout 
}: { 
  token?: string | null; 
  isDemo?: boolean; 
  onLogout: () => void; 
}) {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [athlete, setAthlete] = useState<AthleteProfile | null>(null);
  const [athleteProfileRecord, setAthleteProfileRecord] = useState<AthleteProfileRecord | null>(null);
  const [trainingGoalRecord, setTrainingGoalRecord] = useState<TrainingGoalRecord | null>(null);
  const [weeklyAvailability, setWeeklyAvailability] = useState<AvailabilityRecord[]>([]);
  const [selectedWorkoutDay, setSelectedWorkoutDay] = useState<PlannedWeekDay | null>(null);
  const [rawActivities, setRawActivities] = useState<NormalizedActivity[]>([]);
  const [analysis, setAnalysis] = useState<AnalyzedData | null>(null);
  const [ftp, setFtp] = useState<number>(Number(localStorage.getItem('strava_user_ftp')) || 250);
  const [totalActivitiesInDb, setTotalActivitiesInDb] = useState<number>(0);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState<number>(0);
  const [loadingStreamId, setLoadingStreamId] = useState<number | null>(null);
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState<boolean>(false);
  const [selectedActivity, setSelectedActivity] = useState<NormalizedActivity | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>('all');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState<boolean>(false);
  const [workoutOverrides, setWorkoutOverrides] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('watts_workout_overrides') || '{}');
    } catch {
      return {};
    }
  });

  const handleSelectWorkout = (dateKey: string, templateId: string) => {
    setWorkoutOverrides(prev => {
      const next = { ...prev, [dateKey]: templateId };
      try {
        localStorage.setItem('watts_workout_overrides', JSON.stringify(next));
      } catch (e) {
        console.warn('Could not save workout override:', e);
      }
      return next;
    });
  };

  // Check athlete profile, goal, and availability in Dexie on mount
  useEffect(() => {
    (async () => {
      try {
        const [profile, goal, schedule] = await Promise.all([
          getAthleteProfile(),
          getActiveTrainingGoal(),
          getWeeklyAvailability()
        ]);
        if (profile) {
          setAthleteProfileRecord(profile);
          if (profile.ftp) setFtp(profile.ftp);
        } else if (!isDemo && token) {
          setShowOnboardingModal(true);
        }
        if (goal) setTrainingGoalRecord(goal);
        if (schedule) setWeeklyAvailability(schedule);
      } catch (e) {
        console.warn('Failed to load athlete profile / planner data:', e);
      }
    })();
  }, [isDemo, token]);

  const syncData = async (force: boolean = false, currentFtp: number = ftp) => {
    if (isDemo) {
      setSyncing(true);
      setSyncStatusMessage('Voorbeelddata inladen...');
      setAthlete(DEMO_ATHLETE as AthleteProfile);
      const demoActs = generateDemoActivities();
      setRawActivities(demoActs);
      setAnalysis(analyzeActivities(demoActs, currentFtp));
      setTotalActivitiesInDb(demoActs.length);
      setLastSyncTimestamp(Date.now());
      setSyncing(false);
      setLoading(false);
      return;
    }

    if (!token) return;

    try {
      setSyncing(true);
      setSyncError(null);
      setSyncStatusMessage('Verbinden met Strava...');

      // 1. Fetch Athlete profile
      try {
        const ath = (await getAthlete(token)) as AthleteProfile;
        if (ath.message === 'Authorization Error') {
          console.warn('Strava access token expired. Logging out.');
          onLogout();
          return;
        }
        setAthlete(ath);
        localStorage.setItem('strava_athlete', JSON.stringify(ath));
      } catch (athErr) {
        console.warn('Could not refresh athlete profile, checking local storage:', athErr);
        const cachedAthlete = localStorage.getItem('strava_athlete');
        if (cachedAthlete) {
          try {
            setAthlete(JSON.parse(cachedAthlete));
          } catch {
            // ignore
          }
        }
      }

      // 2. Perform Tier 1 Rate-Limit Safe Sync (90 days)
      const syncResult = await syncActivities(token, {
        lookbackDays: 90,
        forceFull: force,
        onProgress: (msg) => setSyncStatusMessage(msg)
      });

      setTotalActivitiesInDb(syncResult.totalInDb);
      setLastSyncTimestamp(syncResult.lastSyncTime);

      // 3. Load all activities from Dexie IndexedDB
      const allActivities = await getAllActivities();
      setRawActivities(allActivities);
      setTotalActivitiesInDb(allActivities.length);
      const analyzed = analyzeActivities(allActivities, currentFtp);
      setAnalysis(analyzed);

      setSyncStatusMessage(`Klaar! ${syncResult.importedCount} ritten gesynchroniseerd.`);
      setTimeout(() => setSyncStatusMessage(null), 3500);
    } catch (err: unknown) {
      console.error('Sync failed:', err);
      const message = err instanceof Error ? err.message : 'Fout tijdens synchronisatie met Strava.';
      setSyncError(message);

      // Resilient fallback: load existing local activities from Dexie
      try {
        const allActivities = await getAllActivities();
        if (allActivities.length > 0) {
          setTotalActivitiesInDb(allActivities.length);
          const analyzed = analyzeActivities(allActivities, currentFtp);
          setAnalysis(analyzed);
          const lastTime = await getLastSyncTime();
          setLastSyncTimestamp(lastTime);
        }
      } catch (readErr) {
        console.error('Failed to read from local IndexedDB:', readErr);
      }
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    syncData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, isDemo]);

  const handleFtpChange = (newFtp: number) => {
    const val = Math.max(50, Math.min(500, newFtp));
    setFtp(val);
    localStorage.setItem('strava_user_ftp', String(val));
    if (!loading && !syncing) {
      if (isDemo) {
        const demoActs = generateDemoActivities();
        setRawActivities(demoActs);
        setAnalysis(analyzeActivities(demoActs, val));
      } else {
        getAllActivities().then(all => {
          setRawActivities(all);
          setAnalysis(analyzeActivities(all, val));
        });
      }
    }
  };

  const handleOnboardingComplete = async (profile: AthleteProfileRecord) => {
    setAthleteProfileRecord(profile);
    handleFtpChange(profile.ftp);
    try {
      const [goal, schedule] = await Promise.all([
        getActiveTrainingGoal(),
        getWeeklyAvailability()
      ]);
      if (goal) setTrainingGoalRecord(goal);
      if (schedule) setWeeklyAvailability(schedule);
    } catch (e) {
      console.warn('Failed to refresh goal or schedule after onboarding:', e);
    }
  };

  const handleStreamLoaded = async (activityId: number) => {
    const all = await getAllActivities();
    setRawActivities(all);
    setAnalysis(analyzeActivities(all, ftp));
    const updated = all.find(a => a.id === activityId);
    if (updated) setSelectedActivity(updated);
  };

  const handleLoadStream = async (activityId: number) => {
    if (isDemo || !token) return;
    try {
      setLoadingStreamId(activityId);
      await fetchActivityStreams(activityId, token);
      await handleStreamLoaded(activityId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Kon streams niet ophalen: ${msg}`);
    } finally {
      setLoadingStreamId(null);
    }
  };

  const fitnessTrends = useMemo(() => {
    const acts = isDemo ? (analysis?.recentTrends || []) : rawActivities;
    return calculateFitnessTrends(acts, ftp);
  }, [isDemo, analysis?.recentTrends, rawActivities, ftp]);

  const handleClearAllData = async () => {
    await clearAllLocalData();
    setShowClearModal(false);
    onLogout();
  };

  const formatSyncTime = (timestamp: number) => {
    if (!timestamp) return 'Nog niet gesynchroniseerd';
    const date = new Date(timestamp);
    return date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) {
      return `${hrs}u ${mins.toString().padStart(2, '0')}m`;
    }
    return `${mins}m`;
  };

  // Build the 7 days of the current week (Monday to Sunday) via deterministic training planner
  const currentWeekDays: PlannedWeekDay[] = useMemo(() => {
    const acts = isDemo ? (analysis?.recentTrends || []) : rawActivities;
    return generateWeekPlan({
      profile: athleteProfileRecord ? { ...athleteProfileRecord, ftp } : { ftp, weight: 75, max_heartrate: 190, experience_level: 'intermediate', created_at: Date.now(), updated_at: Date.now() },
      goal: trainingGoalRecord,
      availability: weeklyAvailability,
      fitnessSummary: fitnessTrends,
      activities: acts,
      workoutOverrides
    });
  }, [athleteProfileRecord, ftp, trainingGoalRecord, weeklyAvailability, fitnessTrends, isDemo, analysis?.recentTrends, rawActivities, workoutOverrides]);

  // Today's focus item
  const todayItem = useMemo(() => {
    return currentWeekDays.find(d => d.isToday) || currentWeekDays[4] || currentWeekDays[0];
  }, [currentWeekDays]);

  // Keep modal in sync with active plan state
  const activeModalDay = useMemo(() => {
    if (!selectedWorkoutDay) return null;
    return currentWeekDays.find(d => d.dateKey === selectedWorkoutDay.dateKey) || selectedWorkoutDay;
  }, [selectedWorkoutDay, currentWeekDays]);

  // Filtered activity feed list
  const filteredActivities = useMemo(() => {
    let list = analysis?.recentTrends || [];

    if (selectedSportFilter !== 'all') {
      list = list.filter(act => {
        const type = act.sport_type || act.type || 'Ride';
        if (selectedSportFilter === 'virtual') return type === 'VirtualRide';
        if (selectedSportFilter === 'outdoor') return type === 'Ride' || type === 'GravelRide';
        if (selectedSportFilter === 'power') return act.device_watts && act.average_watts;
        return true;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(act => (act.name || '').toLowerCase().includes(q));
    }

    return list;
  }, [analysis, searchQuery, selectedSportFilter]);

  const [showDataModal, setShowDataModal] = useState<boolean>(false);
  const [dismissedProposalId, setDismissedProposalId] = useState<string | null>(null);

  // Intelligent Adaptive Replan Proposal
  const activeProposal = useMemo(() => {
    if (!currentWeekDays || currentWeekDays.length === 0) return null;
    const tsb = fitnessTrends?.currentTsb ?? 0;
    const proposal = generateAdaptiveReplanProposal(currentWeekDays, tsb);
    if (!proposal || proposal.id === dismissedProposalId) return null;
    return proposal;
  }, [currentWeekDays, fitnessTrends, dismissedProposalId]);

  const handleAcceptReplan = () => {
    if (!activeProposal) return;
    const nextOverrides = acceptProposal(activeProposal, workoutOverrides);
    setWorkoutOverrides(nextOverrides);
    setDismissedProposalId(activeProposal.id);
  };

  const handleDeclineReplan = () => {
    if (!activeProposal) return;
    declineProposal(activeProposal.id);
    setDismissedProposalId(activeProposal.id);
  };

  const handleDataRestored = async () => {
    setShowDataModal(false);
    const all = await getAllActivities();
    setRawActivities(all);
    setAnalysis(analyzeActivities(all, ftp));
    const [profile, goal, schedule] = await Promise.all([
      getAthleteProfile(),
      getActiveTrainingGoal(),
      getWeeklyAvailability()
    ]);
    if (profile) {
      setAthleteProfileRecord(profile);
      if (profile.ftp) setFtp(profile.ftp);
    }
    if (goal) setTrainingGoalRecord(goal);
    if (schedule) setWeeklyAvailability(schedule);
    try {
      setWorkoutOverrides(JSON.parse(localStorage.getItem('watts_workout_overrides') || '{}'));
    } catch {
      // ignore
    }
  };

  // Colors & badges
  const typeColors = {
    Endurance: { bg: 'rgba(16, 185, 129, 0.12)', border: 'var(--color-zone-endurance)', text: 'var(--color-zone-endurance)', badge: 'bg-emerald' },
    Threshold: { bg: 'rgba(245, 158, 11, 0.12)', border: 'var(--color-zone-threshold)', text: 'var(--color-zone-threshold)', badge: 'bg-amber' },
    Power: { bg: 'rgba(239, 68, 68, 0.12)', border: 'var(--color-zone-vo2max)', text: 'var(--color-zone-vo2max)', badge: 'bg-rose' },
    Rest: { bg: 'rgba(100, 116, 139, 0.12)', border: 'var(--color-zone-recovery)', text: 'var(--color-zone-recovery)', badge: 'bg-slate' }
  };

  const getSportBadgeLabel = (sportType?: string) => {
    switch (sportType) {
      case 'VirtualRide':
        return 'Zwift / Virtueel';
      case 'GravelRide':
        return 'Gravel';
      case 'MountainBikeRide':
        return 'MTB';
      default:
        return 'Buitenrit';
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="animate-fade-in text-gradient" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '1.25rem' }}>
          <RefreshCw className="spinner" size={24} />
          <span>{syncStatusMessage || 'Trainingsdata inladen...'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container animate-fade-in">
      {/* Demo Banner */}
      {isDemo && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(252, 76, 2, 0.15), rgba(249, 115, 22, 0.15))',
          border: '1px solid rgba(252, 76, 2, 0.3)',
          borderRadius: '12px',
          padding: '0.75rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ 
              background: 'var(--accent-primary)', 
              color: 'white', 
              fontSize: '0.75rem', 
              fontWeight: 700, 
              padding: '0.2rem 0.5rem', 
              borderRadius: '4px', 
              textTransform: 'uppercase' 
            }}>
              Demo Modus
            </span>
            <span style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>
              Interactieve preview met 10 realistische testritten.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button 
              onClick={onLogout} 
              className="btn-glass" 
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              <ArrowLeft size={14} /> Terug naar Home
            </button>
            <button 
              onClick={() => { window.location.href = getStravaAuthUrl(); }} 
              className="btn" 
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Koppel jouw echte Strava
            </button>
          </div>
        </div>
      )}

      {/* Top Header & App Bar */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.25rem', 
        flexWrap: 'wrap', 
        gap: '1rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid var(--border-soft)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(252, 76, 2, 0.35)'
          }}>
            <Zap size={24} color="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--color-text-primary)' }}>
                Watts <span className="text-gradient-orange">Next</span>
              </h1>
              <span style={{ 
                background: 'var(--color-surface-secondary)', 
                color: 'var(--text-muted)', 
                fontSize: '0.75rem', 
                padding: '0.15rem 0.5rem', 
                borderRadius: '6px' 
              }}>
                Adaptive Coach
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Welkom terug, <strong style={{ color: 'var(--text-main)' }}>{athlete?.firstname || 'Renner'}</strong>{athleteProfileRecord?.weight ? ` • ${(ftp / athleteProfileRecord.weight).toFixed(2)} W/kg (${athleteProfileRecord.weight} kg)` : ''} • Persoonlijk wielerschema
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
          {/* Theme Switcher */}
          <ThemeSwitcher />

          {/* FTP Control */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: 'var(--color-surface-secondary)', 
            border: '1px solid var(--border-soft)', 
            borderRadius: '10px', 
            padding: '0.35rem 0.65rem',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>FTP:</span>
            <input 
              type="number" 
              value={ftp}
              onChange={(e) => handleFtpChange(Number(e.target.value))}
              style={{ 
                width: '60px', 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--accent-secondary)', 
                fontSize: '1.15rem', 
                fontWeight: 700, 
                outline: 'none',
                textAlign: 'right'
              }}
              min={50}
              max={500}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500 }}>W</span>
          </div>

          {/* Profile & Goals Modal Trigger */}
          <button 
            className="btn-glass" 
            onClick={() => setShowOnboardingModal(true)}
            title="Beheer je fysiologisch profiel, trainingsdoelen en weekbeschikbaarheid"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <User size={15} style={{ color: 'var(--color-primary)' }} />
            <span>Profiel & Doelen</span>
          </button>

          {/* Data & Backup Modal Trigger */}
          <button 
            className="btn-glass" 
            onClick={() => setShowDataModal(true)}
            title="Lokale data, backups exporteren/importeren en opslagbeveiliging"
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Database size={15} style={{ color: 'var(--color-primary)' }} />
            <span>Data & Backup</span>
          </button>

          {/* Sync Button */}
          <button 
            className="btn-glass" 
            onClick={() => syncData(false)} 
            disabled={syncing}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            <RefreshCw size={15} className={syncing ? 'spinner' : ''} />
            <span>{syncing ? 'Synchroniseren...' : 'Sync Strava'}</span>
          </button>

          {/* Logout / Clear */}
          {!isDemo && (
            <button 
              onClick={() => setShowClearModal(true)}
              title="Wis lokale data"
              style={{
                background: 'transparent',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: 'var(--danger)',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <Trash2 size={14} />
            </button>
          )}

          <button 
            onClick={onLogout} 
            className="btn-glass"
            style={{ padding: '0.5rem 0.9rem', fontSize: '0.85rem', cursor: 'pointer' }}
          >
            {isDemo ? 'Sluit' : 'Uitloggen'}
          </button>
        </div>
      </header>

      {/* Sync Status Toast/Notice */}
      {syncStatusMessage && (
        <div style={{
          background: 'rgba(249, 115, 22, 0.1)',
          border: '1px solid rgba(249, 115, 22, 0.3)',
          borderRadius: '8px',
          padding: '0.6rem 1rem',
          marginBottom: '1.5rem',
          color: 'var(--accent-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.85rem'
        }}>
          <RefreshCw size={14} className={syncing ? 'spinner' : ''} />
          <span>{syncStatusMessage}</span>
        </div>
      )}

      {syncError && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          color: 'var(--danger)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem'
        }}>
          <ShieldAlert size={18} />
          <span>{syncError}</span>
        </div>
      )}

      {/* ADAPTIVE REPLANNING COACH BANNER */}
      {activeProposal && (
        <AdaptiveReplanBanner 
          proposal={activeProposal}
          onAccept={handleAcceptReplan}
          onDecline={handleDeclineReplan}
        />
      )}

      {/* SECTION 1: TODAY'S FOCUS & FITNESS STATUS HERO ROW (SIDE-BY-SIDE) */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: '1.25rem',
          alignItems: 'stretch'
        }}>
          {/* Left Column: Today's Training Focus */}
          <div className="glass-panel" style={{
            borderLeft: todayItem.isCompleted ? '5px solid var(--success)' : `5px solid ${typeColors[todayItem.plannedType].border}`,
            background: todayItem.isCompleted 
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, var(--color-surface) 100%)'
              : `linear-gradient(135deg, ${typeColors[todayItem.plannedType].bg} 0%, var(--color-surface) 100%)`,
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '1rem'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {todayItem.isCompleted ? (
                    <CheckCircle2 size={16} color="var(--success)" />
                  ) : (
                    <Sparkles size={16} color="var(--accent-primary)" />
                  )}
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                    {todayItem.isCompleted ? 'Training Voltooid! 🎉' : 'Wat moet ik vandaag trainen?'} • {todayItem.dayName} {todayItem.dayNumber} {todayItem.monthName}
                  </span>
                </div>
                {todayItem.isCompleted ? (
                  <span style={{
                    backgroundColor: 'var(--success)',
                    color: 'white',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '50px',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <Check size={11} /> Gereden
                  </span>
                ) : (
                  <span style={{
                    backgroundColor: typeColors[todayItem.plannedType].border,
                    color: 'white',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '50px',
                    textTransform: 'uppercase'
                  }}>
                    {todayItem.plannedType}
                  </span>
                )}
              </div>

              {todayItem.isCompleted && todayItem.completedActivities.length > 0 ? (
                <>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 0.35rem 0' }}>
                    {todayItem.completedActivities[0].name}
                    {todayItem.completedActivities.length > 1 && ` (+${todayItem.completedActivities.length - 1} ritten)`}
                  </h2>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={14} /> {formatDuration(todayItem.completedActivities[0].moving_time || 0)}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      📍 {Math.round((todayItem.completedActivities[0].distance || 0) / 1000)} km
                    </span>
                    {todayItem.completedActivities[0].average_watts && (
                      <span style={{ color: 'var(--accent-secondary)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Zap size={14} /> {Math.round(todayItem.completedActivities[0].average_watts)}W gem
                      </span>
                    )}
                    <span style={{ color: 'var(--success)', fontSize: '0.85rem', fontWeight: 700 }}>
                      Belasting: {Math.round(todayItem.totalActualTss || (todayItem.completedActivities[0] as unknown as Record<string, number>).tss || 0)} TSS
                    </span>
                  </div>

                  <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 0.85rem 0' }}>
                    Lekker gewerkt! Je hebt vandaag al getraind en deze rit is verwerkt in je fitness- en vermoeidheidstrends.
                  </p>
                </>
              ) : (
                <>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 0.35rem 0' }}>
                    {todayItem.plannedTitle}
                  </h2>

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={14} /> {todayItem.plannedDuration}
                    </span>
                    {todayItem.plannedWatts !== '-' && (
                      <span style={{ color: 'var(--accent-secondary)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Zap size={14} /> {todayItem.plannedWatts}
                      </span>
                    )}
                  </div>

                  <p style={{ color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.5', margin: '0 0 0.85rem 0' }}>
                    {todayItem.plannedReason}
                  </p>
                </>
              )}
            </div>

            {/* Bottom: Interval Opbouw & Zwift Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid var(--border-soft)'
            }}>
              {todayItem.plannedCategory !== 'rest' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setSelectedWorkoutDay(todayItem)}
                    className="btn-glass"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Activity size={13} style={{ color: 'var(--color-primary)' }} />
                    <span>
                      {todayItem.isCompleted
                        ? `Bekijk geplande intervallen (${todayItem.workout.computedSteps.length} blokken)`
                        : `Bekijk ${todayItem.workout.computedSteps.length} trainingsblokken`}
                    </span>
                  </button>

                  <button
                    onClick={() => downloadZwoFile(todayItem.workout)}
                    className="btn-glass"
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    title="Download gestructureerd .zwo trainingsbestand voor Zwift"
                  >
                    <Download size={13} style={{ color: 'var(--accent-primary)' }} />
                    <span>Download .zwo</span>
                  </button>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Volledige rustdag • Spierherstel en adaptatie
                </div>
              )}

              {!todayItem.isCompleted && analysis?.suggestions?.[0]?.zwiftAlternative && todayItem.plannedCategory !== 'rest' && (
                <a 
                  href={analysis.suggestions[0].zwiftAlternative.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
                >
                  <Bike size={14} /> Open in Zwift
                </a>
              )}
            </div>
          </div>

          {/* Right Column: Fitness & Form (CTL / ATL / TSB) */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <FitnessFormChart summary={fitnessTrends} />
          </div>
        </div>
      </section>

      {/* SECTION 2: 7-DAY WEEKLY SCHEDULE (DE WEEKPLANNING) */}
      <section style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} color="var(--accent-primary)" />
            <h2 style={{ fontSize: '1.35rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              De Weekplanning
            </h2>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginLeft: '0.5rem' }}>
              (Maandag t/m Zondag)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-zone-endurance)' }} /> Duur (Z2)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-zone-threshold)' }} /> Drempel (Z4)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-zone-vo2max)' }} /> VO2 Max (Z5)
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-zone-recovery)' }} /> Rust
            </span>
          </div>
        </div>

        {/* 7 Columns Grid */}
        <div className="week-grid">
          {currentWeekDays.map((item, index) => {
            const hasCompleted = item.completedActivities.length > 0;
            const completedFirst = item.completedActivities[0];
            const typeStyle = typeColors[item.plannedType];

            return (
              <div 
                key={index} 
                onClick={() => setSelectedWorkoutDay(item)}
                className={`day-card ${item.isToday ? 'today' : ''}`}
                style={{
                  borderTop: item.isToday ? '3px solid var(--accent-primary)' : `3px solid ${typeStyle.border}`,
                  cursor: 'pointer'
                }}
                title="Klik voor gedetailleerde trainingsopbouw en doelen"
              >
                {/* Day Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: item.isToday ? 'var(--accent-secondary)' : 'white' }}>
                      {item.shortName}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {item.dayNumber} {item.monthName}
                    </span>
                  </div>

                  {item.isToday && (
                    <span style={{
                      backgroundColor: 'rgba(252, 76, 2, 0.2)',
                      color: 'var(--accent-secondary)',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      textTransform: 'uppercase'
                    }}>
                      Vandaag
                    </span>
                  )}

                  {hasCompleted && !item.isToday && (
                    <span style={{ color: 'var(--success)' }} title="Rit voltooid">
                      <CheckCircle2 size={15} />
                    </span>
                  )}
                </div>

                {/* Workout Block Content */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  {hasCompleted ? (
                    // SHOW COMPLETED RIDE ON THIS DAY
                    <div style={{
                      background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      borderRadius: '8px',
                      padding: '0.6rem',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--success)', fontSize: '0.75rem', fontWeight: 600 }}>
                        <Check size={12} /> Gereden
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {completedFirst.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {Math.round((completedFirst.distance || 0) / 1000)} km • {formatDuration(completedFirst.moving_time || 0)}
                      </div>
                      {completedFirst.average_watts && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', fontWeight: 600 }}>
                          ⚡️ {Math.round(completedFirst.average_watts)}W gem
                        </div>
                      )}
                    </div>
                  ) : (
                    // SHOW PLANNED WORKOUT BLOCK
                    <div style={{
                      background: typeStyle.bg,
                      border: `1px solid ${typeStyle.border}30`,
                      borderRadius: '8px',
                      padding: '0.6rem',
                      marginBottom: '0.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}>
                      <div style={{ fontSize: '0.7rem', color: typeStyle.text, fontWeight: 700, textTransform: 'uppercase' }}>
                        {item.plannedType}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text-primary)', lineHeight: '1.3' }}>
                        {item.plannedTitle}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem' }}>
                        <Clock size={11} /> {item.plannedDuration}
                      </div>
                      {item.plannedWatts !== '-' && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-secondary)', fontWeight: 600 }}>
                          ⚡️ {item.plannedWatts}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Short Reason / Focus */}
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.35', marginTop: 'auto', paddingTop: '0.4rem' }}>
                    {hasCompleted ? (
                      <span style={{ color: 'var(--success)' }}>
                        Belasting: {Math.round(item.totalActualTss || (completedFirst as unknown as Record<string, number>).tss || (completedFirst as unknown as Record<string, number>).analyzedLoad || completedFirst.suffer_score || 0)} TSS
                      </span>
                    ) : (
                      <>
                        <span>{item.plannedReason}</span>
                        {item.plannedCategory !== 'rest' && (
                          <span style={{ display: 'block', color: 'var(--color-primary)', fontSize: '0.7rem', fontWeight: 600, marginTop: '0.25rem' }}>
                            Bekijk stappen →
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: RECENT ACTIVITIES FEED (WAT JE EERDER HEBT GEDAAN - COLLAPSIBLE) */}
      <section style={{ marginBottom: '2.5rem' }}>
        <div 
          onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            flexWrap: 'wrap', 
            gap: '1rem',
            cursor: 'pointer',
            padding: '1rem 1.25rem',
            borderRadius: '12px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--border-soft)',
            boxShadow: 'var(--shadow-sm)',
            transition: 'all 0.2s ease',
            userSelect: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)'
            }}>
              <Activity size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                  Wat je eerder hebt gedaan
                </h2>
                <span style={{
                  background: 'var(--color-surface-secondary)',
                  color: 'var(--text-main)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.55rem',
                  borderRadius: '50px',
                  border: '1px solid var(--border-soft)'
                }}>
                  {filteredActivities.length} ritten
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '0.2rem 0 0 0' }}>
                Chronologisch overzicht van al jouw gesynchroniseerde Strava fietsritten.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn-glass"
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                padding: '0.45rem 0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                cursor: 'pointer'
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsHistoryExpanded(!isHistoryExpanded);
              }}
            >
              <span>{isHistoryExpanded ? 'Inklappen' : `Toon ritten (${filteredActivities.length})`}</span>
              {isHistoryExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {isHistoryExpanded && (
          <div style={{ marginTop: '1.25rem' }}>
            {/* Search & Filter Controls */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '1rem', 
              flexWrap: 'wrap', 
              gap: '0.75rem' 
            }}>
              {/* Filter pills */}
              <div style={{ display: 'flex', background: 'var(--color-surface-secondary)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-soft)' }}>
                {[
                  { id: 'all', label: 'Alles' },
                  { id: 'outdoor', label: 'Buiten' },
                  { id: 'virtual', label: 'Zwift' },
                  { id: 'power', label: 'Met Wattage' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedSportFilter(f.id)}
                    style={{
                      background: selectedSportFilter === f.id ? 'var(--accent-primary)' : 'transparent',
                      color: selectedSportFilter === f.id ? '#ffffff' : 'var(--text-muted)',
                      border: 'none',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'var(--color-surface-secondary)',
                border: '1px solid var(--border-soft)',
                borderRadius: '8px',
                padding: '0.35rem 0.75rem'
              }}>
                <Search size={14} color="var(--text-muted)" />
                <input 
                  type="text" 
                  placeholder="Zoek rit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    width: '140px'
                  }}
                />
              </div>
            </div>

            {/* Activity Feed List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {filteredActivities.map((act) => {
            const hasPower = Boolean(act.device_watts && act.average_watts);
            const hasHr = Boolean(act.has_heartrate && act.average_heartrate);
            const isStreaming = loadingStreamId === act.id;
            const rideDate = new Date(act.start_date || '');

            return (
              <div 
                key={act.id} 
                className="activity-row"
                onClick={() => setSelectedActivity(act)}
                style={{ cursor: 'pointer', transition: 'transform 0.15s ease, border-color 0.15s ease' }}
                title="Klik om ritdetails, vermogenszones en fysiologische berekening te bekijken"
              >
                {/* Left: Icon, Date, Title, Sport Type */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '280px', flex: '1 1 350px' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: act.sport_type === 'VirtualRide' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: act.sport_type === 'VirtualRide' ? 'var(--accent-secondary)' : 'var(--success)',
                    flexShrink: 0
                  }}>
                    <Bike size={20} />
                  </div>

                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ 
                        fontSize: '0.75rem', 
                        color: 'var(--text-muted)', 
                        fontWeight: 500 
                      }}>
                        {rideDate.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })} • {rideDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.45rem',
                        borderRadius: '4px',
                        background: 'var(--color-surface-secondary)',
                        color: 'var(--text-muted)'
                      }}>
                        {getSportBadgeLabel(act.sport_type || act.type)}
                      </span>
                    </div>

                    <div style={{
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      fontSize: '0.95rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {act.name || 'Naamloze rit'}
                    </div>
                  </div>
                </div>

                {/* Middle: Distance, Time, Power, Heart Rate, Elevation */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1.5rem', 
                  flexWrap: 'wrap',
                  justifyContent: 'flex-start'
                }}>
                  {/* Distance */}
                  <div style={{ minWidth: '70px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Afstand</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                      {((act.distance || 0) / 1000).toFixed(1)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>km</span>
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{ minWidth: '70px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Duur</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                      {formatDuration(act.moving_time || 0)}
                    </div>
                  </div>

                  {/* Power */}
                  <div style={{ minWidth: '85px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vermogen</div>
                    {hasPower && act.average_watts != null ? (
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--accent-secondary)' }}>
                        ⚡️ {Math.round(act.average_watts)} <span style={{ fontSize: '0.75rem' }}>W</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>-</div>
                    )}
                  </div>

                  {/* Heart Rate */}
                  <div style={{ minWidth: '75px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hartslag</div>
                    {hasHr && act.average_heartrate != null ? (
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--danger)' }}>
                        ❤️ {Math.round(act.average_heartrate)} <span style={{ fontSize: '0.75rem' }}>bpm</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>-</div>
                    )}
                  </div>

                  {/* Elevation */}
                  <div style={{ minWidth: '65px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Hoogte</div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                      {Math.round(act.total_elevation_gain || 0)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>m</span>
                    </div>
                  </div>
                </div>

                {/* Right: Load Pill & Stream Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
                  {/* Load & Provenance Badge */}
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.25rem 0.65rem',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      backgroundColor: act.has_stream 
                        ? 'rgba(16, 185, 129, 0.15)' 
                        : (act.weighted_average_watts 
                            ? 'rgba(6, 182, 212, 0.15)' 
                            : (act.has_heartrate ? 'rgba(245, 158, 11, 0.15)' : 'var(--color-surface-hover)')),
                      color: act.has_stream 
                        ? '#10b981' 
                        : (act.weighted_average_watts 
                            ? '#06b6d4' 
                            : (act.has_heartrate ? '#f59e0b' : 'var(--color-text-muted)')),
                      border: act.has_stream 
                        ? '1px solid rgba(16, 185, 129, 0.3)' 
                        : (act.weighted_average_watts 
                            ? '1px solid rgba(6, 182, 212, 0.3)' 
                            : (act.has_heartrate ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid var(--color-border)'))
                    }}>
                      {act.has_stream ? 'Stream NP' : (act.weighted_average_watts ? 'Strava NP' : (act.has_heartrate ? 'hrTSS' : 'TSS'))} {Math.round(act.analyzedLoad || 0)}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {act.has_stream ? 'Gemeten' : (act.weighted_average_watts ? 'Berekend' : 'Geschat')}
                    </div>
                  </div>

                  {/* Stream Telemetry button */}
                  {!isDemo && token && (
                    act.has_stream ? (
                      <span 
                        title="Seconde-telemetrie lokaal gecachet (klik rit voor zone-verdeling)"
                        style={{ fontSize: '0.75rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                      >
                        <CheckCircle2 size={16} />
                      </span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadStream(act.id);
                        }}
                        disabled={isStreaming}
                        title="Haal seconde-per-seconde telemetrie op van Strava"
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border-soft)',
                          color: 'var(--text-muted)',
                          borderRadius: '6px',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Cpu size={12} className={isStreaming ? 'spinner' : ''} />
                        <span>{isStreaming ? '...' : 'Laad stream'}</span>
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}

          {filteredActivities.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem 1rem', 
              color: 'var(--text-muted)', 
              background: 'var(--color-surface-secondary)',
              borderRadius: '12px',
              border: '1px dashed var(--border-soft)'
            }}>
              Geen ritten gevonden die voldoen aan de zoekcriteria.
            </div>
          )}
          </div>
        </div>
      )}
    </section>

      {/* Confirmation Modal for Clearing Local Data */}
      {showClearModal && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'var(--color-modal-background)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '2rem' }}>
            <Trash2 size={40} color="var(--danger)" style={{ marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.35rem', marginBottom: '0.5rem', color: 'var(--color-text-primary)' }}>Lokale data wissen?</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              Weet je zeker dat je alle lokaal opgeslagen Strava-ritten, streams en tokens wilt verwijderen uit je browser (IndexedDB)? Je wordt daarna uitgelogd.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button 
                onClick={() => setShowClearModal(false)}
                className="btn-glass"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Annuleren
              </button>
              <button 
                onClick={handleClearAllData}
                className="btn"
                style={{ background: 'var(--danger)', padding: '0.6rem 1.25rem' }}
              >
                Ja, wis alles
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Onboarding & Profile Modal */}
      <OnboardingModal
        isOpen={showOnboardingModal}
        onClose={() => setShowOnboardingModal(false)}
        onComplete={handleOnboardingComplete}
        initialFtp={ftp}
      />

      {/* Activity Detail Modal */}
      <ActivityDetailModal
        activity={selectedActivity}
        isOpen={Boolean(selectedActivity)}
        onClose={() => setSelectedActivity(null)}
        ftp={ftp}
        token={token}
        isDemo={isDemo}
        onStreamLoaded={handleStreamLoaded}
      />

      {/* Workout Detail Modal */}
      <WorkoutDetailModal
        day={activeModalDay}
        onClose={() => setSelectedWorkoutDay(null)}
        onEditAvailability={() => setShowOnboardingModal(true)}
        onSelectWorkout={handleSelectWorkout}
      />

      {/* Data Management & Backup Modal */}
      <DataManagementModal
        isOpen={showDataModal}
        onClose={() => setShowDataModal(false)}
        onDataRestored={handleDataRestored}
        onPromptClearData={() => setShowClearModal(true)}
      />

      {/* Footer Info */}
      <footer style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Database size={14} />
          <span><strong>{totalActivitiesInDb}</strong> ritten lokaal opgeslagen via Dexie IndexedDB (geen externe database).</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Radio size={14} />
          <span>Laatste Strava sync: {formatSyncTime(lastSyncTimestamp)}</span>
        </div>
      </footer>

      <style dangerouslySetInnerHTML={{__html: `
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
