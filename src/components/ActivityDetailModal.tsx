import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  ExternalLink,
  DownloadCloud
} from 'lucide-react';
import type { NormalizedActivity, ActivityStreamRecord } from '../lib/db';
import { getActivityStream } from '../lib/db';
import { fetchActivityStreams } from '../api/strava';
import { 
  calculateActivityPhysiology, 
  calculateZoneDistribution, 
  type ActivityPhysiology 
} from '../lib/physiology';

interface ActivityDetailModalProps {
  activity: NormalizedActivity | null;
  isOpen: boolean;
  onClose: () => void;
  ftp: number;
  token?: string | null;
  onStreamLoaded?: (activityId: number) => void;
  isDemo?: boolean;
}

export default function ActivityDetailModal({
  activity,
  isOpen,
  onClose,
  ftp,
  token,
  onStreamLoaded,
  isDemo = false
}: ActivityDetailModalProps) {
  const [stream, setStream] = useState<ActivityStreamRecord | null>(null);
  const [loadingStream, setLoadingStream] = useState<boolean>(false);
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!activity || !isOpen) {
      setStream(null);
      setStreamError(null);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const cachedStream = await getActivityStream(activity.id);
        if (isMounted) {
          setStream(cachedStream || null);
        }
      } catch (err) {
        console.error('Error fetching cached stream:', err);
      }
    })();

    return () => { isMounted = false; };
  }, [activity, isOpen]);

  if (!isOpen || !activity) return null;

  const physiology: ActivityPhysiology = calculateActivityPhysiology(activity, ftp, stream);

  const handleFetchStream = async () => {
    if (isDemo || !token) return;
    try {
      setLoadingStream(true);
      setStreamError(null);
      const loaded = await fetchActivityStreams(activity.id, token);
      setStream(loaded);
      if (onStreamLoaded) {
        onStreamLoaded(activity.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setStreamError(`Kon telemetry niet ophalen: ${msg}`);
    } finally {
      setLoadingStream(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}u ${mins.toString().padStart(2, '0')}m`;
    }
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('nl-NL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const getProvenanceBadge = (prov: ActivityPhysiology['provenance']) => {
    switch (prov) {
      case 'measured_stream':
        return {
          bg: 'rgba(16, 185, 129, 0.15)',
          border: '#10b981',
          text: '#10b981',
          title: 'Gemeten via Seconde-stream',
          desc: '100% deterministisch: 30-seconden rollend gemiddelde, 4e macht Coggan NP & IF.'
        };
      case 'calculated_weighted':
        return {
          bg: 'rgba(6, 182, 212, 0.15)',
          border: '#06b6d4',
          text: '#06b6d4',
          title: 'Berekend (Strava Weighted Watts)',
          desc: 'Gebaseerd op Strava’s gewogen vermogen als proxy voor Normalized Power.'
        };
      case 'estimated_heartrate':
        return {
          bg: 'rgba(245, 158, 11, 0.15)',
          border: '#f59e0b',
          text: '#f59e0b',
          title: 'Geschat via Hartslag (hrTSS)',
          desc: 'Geen vermogensmeter gekoppeld; belasting geschat via gemiddelde hartslag & anaerobe drempel.'
        };
      case 'estimated_suffer_score':
        return {
          bg: 'rgba(236, 72, 153, 0.15)',
          border: '#ec4899',
          text: '#ec4899',
          title: 'Geschat via Strava Suffer Score',
          desc: 'Belasting gebaseerd op Strava Relative Effort.'
        };
      default:
        return {
          bg: 'rgba(148, 163, 184, 0.15)',
          border: '#94a3b8',
          text: '#94a3b8',
          title: 'Geschat via Rittijd',
          desc: 'Geen sensorgegevens beschikbaar; geschat op 40 TSS/uur voor matige duurrit.'
        };
    }
  };

  const badge = getProvenanceBadge(physiology.provenance);
  const zoneDist = stream?.watts ? calculateZoneDistribution(stream.watts, ftp) : undefined;

  const modalContent = (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
        maxWidth: '42rem',
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
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--color-surface)',
          zIndex: 10
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '0.2rem 0.5rem',
                borderRadius: '0.25rem',
                backgroundColor: 'rgba(255, 107, 0, 0.15)',
                color: 'var(--color-primary)'
              }}>
                {activity.sport_type || activity.type}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {formatDate(activity.start_date_local || activity.start_date)}
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-text-main)' }}>
              {activity.name}
            </h2>
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

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Key Metrics Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '0.75rem'
          }}>
            {/* TSS Load */}
            <div style={{
              backgroundColor: 'var(--color-surface-hover)',
              padding: '0.875rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Trainingsbelasting
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-primary)', marginTop: '0.2rem' }}>
                {physiology.load} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>TSS</span>
              </div>
            </div>

            {/* Normalized Power */}
            <div style={{
              backgroundColor: 'var(--color-surface-hover)',
              padding: '0.875rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Normalized Power
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#06b6d4', marginTop: '0.2rem' }}>
                {physiology.np ? `${physiology.np}W` : '-'}
              </div>
            </div>

            {/* Intensity Factor */}
            <div style={{
              backgroundColor: 'var(--color-surface-hover)',
              padding: '0.875rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Intensity Factor (IF)
              </span>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#ec4899', marginTop: '0.2rem' }}>
                {physiology.if !== null ? physiology.if : '-'}
              </div>
            </div>

            {/* Distance & Time */}
            <div style={{
              backgroundColor: 'var(--color-surface-hover)',
              padding: '0.875rem',
              borderRadius: '0.75rem',
              border: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Afstand & Duur
              </span>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text-main)', marginTop: '0.2rem' }}>
                {(activity.distance / 1000).toFixed(1)} km
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {formatDuration(activity.moving_time)}
              </span>
            </div>
          </div>

          {/* Data Provenance Card */}
          <div style={{
            backgroundColor: badge.bg,
            border: `1px solid ${badge.border}55`,
            borderRadius: '0.75rem',
            padding: '1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: badge.border,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
              marginTop: '0.1rem'
            }}>
              {physiology.provenance === 'measured_stream' ? (
                <CheckCircle2 size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: badge.text }}>
                  {badge.title}
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  Toegepaste FTP: {ftp}W
                </span>
              </div>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-text-main)', lineHeight: 1.4 }}>
                {badge.desc}
              </p>
            </div>
          </div>

          {/* Lazy Stream Sync Trigger (if not cached and power was recorded or available) */}
          {physiology.provenance !== 'measured_stream' && !isDemo && token && (
            <div style={{
              backgroundColor: 'var(--color-surface-hover)',
              border: '1px dashed var(--color-border)',
              borderRadius: '0.75rem',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                  Exacte Vermogens- & Zone-analyse beschikbaar
                </span>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Haal seconde-voor-seconde vermogensdata op via de Strava API voor exacte NP en tijdsduur per zone.
                </p>
                {streamError && (
                  <span style={{ color: '#ef4444', fontSize: '0.75rem', display: 'block', marginTop: '0.25rem' }}>
                    {streamError}
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={loadingStream}
                onClick={handleFetchStream}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.6rem 1rem',
                  borderRadius: '0.5rem',
                  border: 'none',
                  backgroundColor: 'var(--color-primary)',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: loadingStream ? 'not-allowed' : 'pointer',
                  flexShrink: 0
                }}
              >
                <DownloadCloud size={16} />
                {loadingStream ? 'Stream ophalen...' : 'Haal Seconde-data op'}
              </button>
            </div>
          )}

          {/* Power Zones Distribution (when stream is available) */}
          {zoneDist && zoneDist.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <Layers size={16} style={{ color: 'var(--color-primary)' }} /> Vermogenszones Verdeling (Coggan Z1 - Z7)
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {stream?.watts?.length} seconden geregistreerd
                </span>
              </div>

              {/* Stacked bar visual */}
              <div style={{
                display: 'flex',
                height: '14px',
                borderRadius: '7px',
                overflow: 'hidden',
                width: '100%',
                backgroundColor: 'var(--color-surface-hover)'
              }}>
                {zoneDist.map(z => (
                  <div
                    key={z.zoneCode}
                    title={`${z.zoneName}: ${z.percentage}% (${formatDuration(z.seconds)})`}
                    style={{
                      width: `${z.percentage}%`,
                      backgroundColor: z.colorToken,
                      transition: 'width 0.3s ease'
                    }}
                  />
                ))}
              </div>

              {/* Zone List Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', marginTop: '0.25rem' }}>
                {zoneDist.map(z => (
                  <div
                    key={z.zoneCode}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '0.375rem',
                      backgroundColor: 'var(--color-surface-hover)',
                      fontSize: '0.75rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: z.colorToken }} />
                      <strong style={{ color: 'var(--color-text-main)' }}>{z.zoneCode}</strong>
                      <span style={{ color: 'var(--color-text-muted)' }}>{z.zoneName.split(' ')[0]}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ color: 'var(--color-text-main)' }}>{z.percentage}%</strong>
                      <span style={{ color: 'var(--color-text-muted)', marginLeft: '0.3rem' }}>({formatDuration(z.seconds)})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sensor Summary Table */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.75rem',
            backgroundColor: 'var(--color-surface-hover)',
            borderRadius: '0.75rem',
            padding: '0.875rem',
            border: '1px solid var(--color-border)',
            fontSize: '0.8rem'
          }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem' }}>Gemiddeld Vermogen</span>
              <strong style={{ fontSize: '1rem', color: 'var(--color-text-main)' }}>
                {activity.average_watts ? `${Math.round(activity.average_watts)} W` : '-'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem' }}>Max Vermogen</span>
              <strong style={{ fontSize: '1rem', color: 'var(--color-text-main)' }}>
                {activity.max_watts ? `${Math.round(activity.max_watts)} W` : '-'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem' }}>Hoogtemeters</span>
              <strong style={{ fontSize: '1rem', color: 'var(--color-text-main)' }}>
                {activity.total_elevation_gain ? `${Math.round(activity.total_elevation_gain)} hm` : '0 hm'}
              </strong>
            </div>

            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem' }}>Gemiddelde Hartslag</span>
              <strong style={{ fontSize: '1rem', color: '#ef4444' }}>
                {activity.average_heartrate ? `${Math.round(activity.average_heartrate)} bpm` : '-'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem' }}>Max Hartslag</span>
              <strong style={{ fontSize: '1rem', color: '#ef4444' }}>
                {activity.max_heartrate ? `${Math.round(activity.max_heartrate)} bpm` : '-'}
              </strong>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', fontSize: '0.7rem' }}>Gemiddelde Cadans</span>
              <strong style={{ fontSize: '1rem', color: 'var(--color-text-main)' }}>
                {activity.average_cadence ? `${Math.round(activity.average_cadence)} rpm` : '-'}
              </strong>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--color-surface)',
          position: 'sticky',
          bottom: 0,
          zIndex: 10
        }}>
          <a
            href={`https://www.strava.com/activities/${activity.id}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              color: 'var(--color-text-muted)',
              fontSize: '0.8rem',
              textDecoration: 'none'
            }}
          >
            Bekijk op Strava <ExternalLink size={14} />
          </a>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-surface-hover)',
              color: 'var(--color-text-main)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Sluiten
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
