import { Sparkles, ArrowRight, CheckCircle2, ShieldAlert, X, Calendar } from 'lucide-react';
import type { ReplanProposal } from '../lib/adaptiveCoach';

interface AdaptiveReplanBannerProps {
  proposal: ReplanProposal;
  onAccept: () => void;
  onDecline: () => void;
}

export default function AdaptiveReplanBanner({
  proposal,
  onAccept,
  onDecline
}: AdaptiveReplanBannerProps) {
  return (
    <div 
      className="glass-panel"
      style={{
        marginBottom: '1rem',
        borderLeft: '4px solid var(--accent-primary)',
        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, var(--color-surface) 100%)',
        padding: '0.85rem 1.15rem',
        borderRadius: '12px',
        boxShadow: 'var(--shadow-md)',
        animation: 'fadeIn 0.2s ease-out',
        position: 'relative'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            backgroundColor: 'rgba(249, 115, 22, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)'
          }}>
            <Sparkles size={14} />
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent-primary)' }}>
            Slimme Coach • Adaptief Herplanvoorstel
          </span>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '0.1rem 0.45rem',
            borderRadius: '50px',
            backgroundColor: proposal.triggerType === 'missed_workout' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)',
            color: proposal.triggerType === 'missed_workout' ? '#3b82f6' : '#f59e0b',
            textTransform: 'uppercase'
          }}>
            {proposal.triggerType === 'missed_workout' ? 'Inhaalsessie' : 'Vermoeidheid'}
          </span>
        </div>

        <button
          onClick={onDecline}
          title="Voorstel verbergen"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '0.2rem',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Main explanation */}
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 0.25rem 0' }}>
        {proposal.title}
      </h3>
      <p style={{ color: 'var(--text-main)', fontSize: '0.82rem', lineHeight: '1.4', margin: '0 0 0.65rem 0' }}>
        {proposal.triggerDescription}
      </p>

      {/* Proposed Changes Preview Box */}
      <div style={{
        backgroundColor: 'var(--color-surface-secondary)',
        border: '1px solid var(--border-soft)',
        borderRadius: '8px',
        padding: '0.6rem 0.85rem',
        marginBottom: '0.65rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.45rem'
      }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <Calendar size={12} />
          <span>Voorgestelde wijziging in je weekplanning:</span>
        </div>

        {proposal.changes.map((ch, idx) => (
          <div 
            key={idx} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.5rem',
              fontSize: '0.82rem'
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', minWidth: '80px' }}>
              {ch.dayName}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
              <span style={{ color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                {ch.originalTitle}
              </span>
              <ArrowRight size={13} color="var(--accent-primary)" />
              <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>
                {ch.proposedTitle}
              </span>
            </div>

            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {ch.reason}
            </div>
          </div>
        ))}
      </div>

      {/* Consequence if not accepted */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.45rem',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        marginBottom: '0.75rem'
      }}>
        <ShieldAlert size={14} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
        <span><strong>Waarom?</strong> {proposal.consequenceIfNotAccepted}</span>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={onAccept}
          className="btn"
          style={{
            padding: '0.4rem 0.95rem',
            fontSize: '0.8rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            cursor: 'pointer'
          }}
        >
          <CheckCircle2 size={15} />
          <span>Plan automatisch aanpassen</span>
        </button>

        <button
          onClick={onDecline}
          className="btn-glass"
          style={{
            padding: '0.4rem 0.85rem',
            fontSize: '0.8rem',
            cursor: 'pointer'
          }}
        >
          Behoud origineel plan
        </button>
      </div>
    </div>
  );
}
