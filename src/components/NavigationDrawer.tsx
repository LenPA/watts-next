import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  User, 
  Database, 
  RefreshCw, 
  Trash2, 
  LogOut, 
  Sun, 
  Moon, 
  Check, 
  ChevronRight,
  Zap
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import type { AthleteProfile } from './Dashboard';
import type { AthleteProfileRecord } from '../lib/db';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  athlete?: AthleteProfile | null;
  athleteProfileRecord?: AthleteProfileRecord | null;
  ftp: number;
  isDemo?: boolean;
  syncing?: boolean;
  onOpenProfile: () => void;
  onOpenDataBackup: () => void;
  onSyncStrava: () => void;
  onPromptClearData: () => void;
  onLogout: () => void;
}

export default function NavigationDrawer({
  isOpen,
  onClose,
  athlete,
  athleteProfileRecord,
  ftp,
  isDemo = false,
  syncing = false,
  onOpenProfile,
  onOpenDataBackup,
  onSyncStrava,
  onPromptClearData,
  onLogout
}: NavigationDrawerProps) {
  const { theme, setTheme, themes } = useTheme();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key & manage focus
  useEffect(() => {
    if (!isOpen) return;

    // Focus close button on open
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const athleteName = athlete?.firstname || 'Renner';
  const weight = athleteProfileRecord?.weight;
  const wKg = weight && weight > 0 ? (ftp / weight).toFixed(2) : null;

  const content: ReactNode = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Navigatiemenu"
    >
      <div
        ref={drawerRef}
        id="navigation-drawer"
        style={{
          width: '100%',
          maxWidth: '340px',
          height: '100%',
          backgroundColor: 'var(--color-surface)',
          borderLeft: '1px solid var(--border-soft)',
          boxShadow: 'var(--shadow-panel)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflowY: 'auto'
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.25rem 1rem',
            borderBottom: '1px solid var(--border-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface-secondary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                boxShadow: '0 2px 10px rgba(236, 72, 153, 0.25)'
              }}
            >
              <Zap size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text-primary)' }}>
                {athleteName}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {wKg ? `${wKg} W/kg • ${weight} kg` : `FTP: ${ftp} W`}
              </div>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Sluit menu"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Body / Navigation List */}
        <div style={{ padding: '1rem 0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
          
          {/* Profile & Goals */}
          <button
            onClick={() => {
              onClose();
              onOpenProfile();
            }}
            className="drawer-item"
            style={drawerItemStyle}
          >
            <div style={drawerItemLeftStyle}>
              <div style={iconBoxStyle}>
                <User size={18} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                  Profiel & Doelen
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  FTP, gewicht, hartslag & streefdoelen
                </div>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
          </button>

          {/* Data & Backup */}
          <button
            onClick={() => {
              onClose();
              onOpenDataBackup();
            }}
            className="drawer-item"
            style={drawerItemStyle}
          >
            <div style={drawerItemLeftStyle}>
              <div style={iconBoxStyle}>
                <Database size={18} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                  Data & Backup
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Exporteer, importeer of wis lokale ritten
                </div>
              </div>
            </div>
            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
          </button>

          {/* Sync Strava */}
          <button
            onClick={() => {
              onSyncStrava();
            }}
            disabled={syncing}
            className="drawer-item"
            style={{
              ...drawerItemStyle,
              opacity: syncing ? 0.7 : 1,
              cursor: syncing ? 'wait' : 'pointer'
            }}
          >
            <div style={drawerItemLeftStyle}>
              <div style={iconBoxStyle}>
                <RefreshCw size={18} className={syncing ? 'spinner' : ''} style={{ color: 'var(--color-primary)' }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                  {syncing ? 'Synchroniseren...' : 'Sync Strava'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Laatste ritten en TSS ophalen
                </div>
              </div>
            </div>
            {syncing && <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>Bezig...</span>}
          </button>

          {/* SECTION: Theme Selector */}
          <div style={{ marginTop: '0.85rem', marginBottom: '0.5rem', padding: '0 0.5rem' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Thema Selectie
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {themes.map((t) => {
                const isSelected = t.id === theme;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid var(--color-primary)' : '1px solid var(--border-soft)',
                      backgroundColor: isSelected ? 'var(--color-primary-light)' : 'transparent',
                      color: 'var(--color-text-primary)',
                      cursor: 'pointer',
                      minHeight: '44px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {t.mode === 'dark' ? (
                        <Moon size={15} style={{ color: 'var(--color-primary)' }} />
                      ) : (
                        <Sun size={15} style={{ color: 'var(--color-primary)' }} />
                      )}
                      <div style={{ textAlign: 'left' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{t.name}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: t.previewColors.background, border: '1px solid rgba(128,128,128,0.3)', display: 'inline-block' }} />
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: t.previewColors.surface, border: '1px solid rgba(128,128,128,0.3)', display: 'inline-block' }} />
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: t.previewColors.primary, display: 'inline-block' }} />
                      </div>
                      {isSelected && <Check size={15} style={{ color: 'var(--color-primary)' }} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ height: '1px', backgroundColor: 'var(--border-soft)', margin: '0.5rem 0.5rem' }} />

          {/* Delete Data */}
          {!isDemo && (
            <button
              onClick={() => {
                onClose();
                onPromptClearData();
              }}
              className="drawer-item"
              style={{
                ...drawerItemStyle,
                color: 'var(--danger)'
              }}
            >
              <div style={drawerItemLeftStyle}>
                <div style={{ ...iconBoxStyle, backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                  <Trash2 size={18} style={{ color: 'var(--danger)' }} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--danger)' }}>
                    Data wissen
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Lokale ritten en instellingen resetten
                  </div>
                </div>
              </div>
            </button>
          )}

          {/* Logout */}
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="drawer-item"
            style={drawerItemStyle}
          >
            <div style={drawerItemLeftStyle}>
              <div style={iconBoxStyle}>
                <LogOut size={18} style={{ color: 'var(--text-muted)' }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-text-primary)' }}>
                  {isDemo ? 'Sluit Demo' : 'Uitloggen'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Sessie beëindigen
                </div>
              </div>
            </div>
          </button>
        </div>

        {/* Drawer Footer */}
        <div
          style={{
            padding: '0.85rem 1.25rem',
            borderTop: '1px solid var(--border-soft)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            background: 'var(--color-surface-secondary)'
          }}
        >
          Watts Next • Adaptive Coach
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

const drawerItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '0.65rem 0.75rem',
  borderRadius: '10px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  minHeight: '48px',
  transition: 'background-color 0.15s ease'
};

const drawerItemLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem'
};

const iconBoxStyle: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  backgroundColor: 'var(--color-surface-secondary)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0
};
