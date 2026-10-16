import { useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Moon, Sun, Check } from 'lucide-react';

export default function ThemeSwitcher() {
  const { theme, setTheme, themes, activeThemeConfig } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn-glass"
        title={`Thema wijzigen (nu: ${activeThemeConfig.name})`}
        aria-label="Thema wijzigen"
        aria-expanded={isOpen}
        style={{
          padding: '0.45rem 0.85rem',
          fontSize: '0.85rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.45rem',
          cursor: 'pointer',
          borderRadius: '8px'
        }}
      >
        {activeThemeConfig.mode === 'dark' ? (
          <Moon size={15} style={{ color: 'var(--color-primary)' }} />
        ) : (
          <Sun size={15} style={{ color: 'var(--color-primary)' }} />
        )}
        <span style={{ fontWeight: 600 }}>{activeThemeConfig.name}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '260px',
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '0.5rem',
            boxShadow: 'var(--shadow-card-hover)',
            zIndex: 1000,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <div
            style={{
              padding: '0.35rem 0.6rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              borderBottom: '1px solid var(--color-border)',
              marginBottom: '0.35rem'
            }}
          >
            Kies thema
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {themes.map(t => {
              const isSelected = t.id === theme;
              return (
                <button
                  key={t.id}
                  role="menuitem"
                  onClick={() => {
                    setTheme(t.id);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid var(--color-primary)' : '1px solid transparent',
                    backgroundColor: isSelected ? 'var(--color-primary-light)' : 'transparent',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'var(--color-surface-secondary)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: t.previewColors.background,
                          border: '1px solid rgba(128,128,128,0.3)',
                          display: 'inline-block'
                        }}
                      />
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: t.previewColors.surface,
                          border: '1px solid rgba(128,128,128,0.3)',
                          display: 'inline-block'
                        }}
                      />
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: t.previewColors.primary,
                          display: 'inline-block'
                        }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)' }}>
                        {t.description}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <Check size={16} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
