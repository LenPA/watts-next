import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Database, 
  Download, 
  Upload, 
  ShieldCheck, 
  ShieldAlert, 
  X, 
  Trash2, 
  HardDrive, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { 
  checkStoragePersistence, 
  requestStoragePersistence, 
  downloadDatabaseBackupFile, 
  importFullDatabaseJson, 
  type StorageStatus 
} from '../lib/dataManagement';

interface DataManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored?: () => void;
  onPromptClearData?: () => void;
}

export default function DataManagementModal({
  isOpen,
  onClose,
  onDataRestored,
  onPromptClearData
}: DataManagementModalProps) {
  const [storageStatus, setStorageStatus] = useState<StorageStatus>({ isPersistent: false, supported: false });
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [importStatus, setImportStatus] = useState<{ loading: boolean; message?: string; error?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      checkStoragePersistence().then(setStorageStatus);
      setImportStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRequestPersistence = async () => {
    await requestStoragePersistence();
    const updated = await checkStoragePersistence();
    setStorageStatus(updated);
  };

  const handleExport = async () => {
    setIsExporting(true);
    await downloadDatabaseBackupFile();
    setIsExporting(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus({ loading: true });

    try {
      const text = await file.text();
      const res = await importFullDatabaseJson(text);
      if (res.success) {
        setImportStatus({ loading: false, message: res.message });
        if (onDataRestored) {
          setTimeout(() => {
            onDataRestored();
          }, 800);
        }
      } else {
        setImportStatus({ loading: false, error: res.error });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setImportStatus({ loading: false, error: `Bestand kon niet gelezen worden: ${msg}` });
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

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
          maxWidth: '580px',
          maxHeight: '90vh',
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
            <Database size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
              Lokale Data & Backup Beheer
            </h3>
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

        {/* Content */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Section 1: Storage Persistence */}
          <div style={{
            backgroundColor: 'var(--color-surface-secondary)',
            border: '1px solid var(--border-soft)',
            borderRadius: '10px',
            padding: '1rem 1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-text-primary)' }}>
                <HardDrive size={16} color="var(--accent-primary)" />
                <span>Browser Opslag (IndexedDB)</span>
              </div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '0.15rem 0.55rem',
                borderRadius: '50px',
                backgroundColor: storageStatus.isPersistent ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: storageStatus.isPersistent ? '#10b981' : '#f59e0b'
              }}>
                {storageStatus.isPersistent ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                {storageStatus.isPersistent ? 'Permanent Beveiligd' : 'Standaard Opslag'}
              </span>
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.45', margin: '0 0 0.75rem 0' }}>
              Watts Next bewaart al jouw Strava-ritten, wattagestreams en plannen 100% lokaal in je browser.
              {storageStatus.usageFormatted && ` Huidig gebruik: ${storageStatus.usageFormatted} (van ${storageStatus.quotaFormatted} beschikbaar).`}
            </p>

            {!storageStatus.isPersistent && storageStatus.supported && (
              <button
                onClick={handleRequestPersistence}
                className="btn-glass"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <ShieldCheck size={14} color="var(--success)" />
                <span>Opslag permanent beveiligen tegen browser-cleanup</span>
              </button>
            )}
          </div>

          {/* Section 2: JSON Backup & Restore */}
          <div>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 0.5rem 0' }}>
              Volledige Backup & Herstel
            </h4>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.45', margin: '0 0 1rem 0' }}>
              Maak een complete momentopname van al je ritten, doelen en instellingen in een enkel JSON-bestand. Hiermee kun je altijd je data overzetten naar een ander apparaat of herstellen na het legen van je browsercache.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {/* Export button */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="btn"
                style={{
                  padding: '0.55rem 1.1rem',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: isExporting ? 'not-allowed' : 'pointer'
                }}
              >
                <Download size={15} />
                <span>{isExporting ? 'Exporteren...' : 'Download backup (.json)'}</span>
              </button>

              {/* Import button */}
              <input 
                type="file" 
                ref={fileInputRef} 
                accept=".json,application/json" 
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importStatus?.loading}
                className="btn-glass"
                style={{
                  padding: '0.55rem 1.1rem',
                  fontSize: '0.85rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: importStatus?.loading ? 'not-allowed' : 'pointer'
                }}
              >
                <Upload size={15} />
                <span>{importStatus?.loading ? 'Bezig met importeren...' : 'Herstel backup (.json)'}</span>
              </button>
            </div>

            {/* Status alerts */}
            {importStatus?.message && (
              <div style={{
                marginTop: '0.85rem',
                padding: '0.65rem 0.9rem',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                fontSize: '0.82rem',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <CheckCircle2 size={16} />
                <span>{importStatus.message}</span>
              </div>
            )}

            {importStatus?.error && (
              <div style={{
                marginTop: '0.85rem',
                padding: '0.65rem 0.9rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                fontSize: '0.82rem',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}>
                <AlertCircle size={16} />
                <span>{importStatus.error}</span>
              </div>
            )}
          </div>

          {/* Section 3: Reset Local Storage */}
          {onPromptClearData && (
            <div style={{
              borderTop: '1px solid var(--border-soft)',
              paddingTop: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--danger)' }}>
                  Lokale opslag leegmaken
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Verwijdert alle gecachete Strava-ritten en instellingen uit deze browser.
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onPromptClearData();
                }}
                className="btn-glass"
                style={{
                  fontSize: '0.8rem',
                  padding: '0.4rem 0.85rem',
                  color: 'var(--danger)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Trash2 size={14} />
                <span>Data wissen</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border-soft)',
          display: 'flex',
          justifyContent: 'flex-end',
          background: 'var(--color-surface-secondary)'
        }}>
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
  );

  return createPortal(modal, document.body);
}
