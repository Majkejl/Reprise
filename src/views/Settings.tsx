// Settings.tsx — session preferences, full data export, and local lesson import.

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { exportFull, exportProgress, importData, importLocalLesson, downloadBlob } from '@/services/exportImportService'
import { SettingsRepo } from '@/db'
import { useErrorStore } from '@/stores/uiStore'
import { DEFAULT_SESSION_CAP } from '@/lib/types'

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10, color: 'var(--c-text3)', letterSpacing: '0.07em', fontStyle: 'italic', marginBottom: 8,
}

const secondaryButtonStyle: React.CSSProperties = {
  background: 'none', border: '1px solid var(--c-border)', borderRadius: 4,
  color: 'var(--c-text2)', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', padding: '6px 12px',
}

export function Settings() {
  const [sessionCap, setSessionCap] = useState<number>(DEFAULT_SESSION_CAP)
  const [isImporting, setIsImporting] = useState(false)
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const lessonFileInputRef = useRef<HTMLInputElement>(null)
  const showError = useErrorStore(s => s.show)

  useEffect(() => {
    async function loadSettings() {
      try {
        const stored = await SettingsRepo.get<number>('sessionCap')
        if (stored !== undefined) setSessionCap(stored)
      } catch (e) {
        showError(String(e))
      }
    }
    void loadSettings()
  }, [showError])

  const handleSessionCapChange = async (value: number) => {
    const capped = Math.max(1, Math.min(200, value))
    setSessionCap(capped)
    try {
      await SettingsRepo.set('sessionCap', capped)
    } catch (e) {
      showError(String(e))
    }
  }

  const handleExportFull = async () => {
    try {
      const blob = await exportFull()
      const date = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `reprise-full-${date}.json`)
    } catch (e) {
      showError(String(e))
    }
  }

  const handleExportProgress = async () => {
    try {
      const blob = await exportProgress()
      const date = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `reprise-progress-${date}.json`)
    } catch (e) {
      showError(String(e))
    }
  }

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    setImportSuccessMessage(null)
    try {
      const text = await file.text()
      await importData(text)
      setImportSuccessMessage('Import complete. Refresh the page to see updated data.')
    } catch (e) {
      showError(String(e))
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleImportLesson = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsImporting(true)
    setImportSuccessMessage(null)
    try {
      const text = await file.text()
      await importLocalLesson(text)
      setImportSuccessMessage(
        'Lesson imported. If it includes a custom renderer, refresh the page to activate it.',
      )
    } catch (e) {
      showError(String(e))
    } finally {
      setIsImporting(false)
      if (lessonFileInputRef.current) lessonFileInputRef.current.value = ''
    }
  }

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 512, margin: '0 auto' }}>
      <h1 style={{ fontSize: 16, color: 'var(--c-text)', fontWeight: 500 }}>Settings</h1>

      {/* Session */}
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 7, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-border)' }}>
          <div style={sectionLabelStyle}>// SESSION</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--c-text)' }}>Cards per session</div>
              <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 3, lineHeight: 1.4 }}>Max cards shown per study session</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => handleSessionCapChange(sessionCap - 5)}
                style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--c-raised)', border: '1px solid var(--c-border)', color: 'var(--c-text2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >−</button>
              <span style={{ fontSize: 12, color: 'var(--c-text)', minWidth: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{sessionCap}</span>
              <button
                onClick={() => handleSessionCapChange(sessionCap + 5)}
                style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--c-raised)', border: '1px solid var(--c-border)', color: 'var(--c-text2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >+</button>
            </div>
          </div>
        </div>
      </div>

      {/* Export */}
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 7, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--c-border)' }}>
          <div style={sectionLabelStyle}>// EXPORT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ExportButton label="Full export" description="All lessons, progress, history" onClick={handleExportFull} />
            <ExportButton label="Progress only" description="Card states + settings, no lesson content" onClick={handleExportProgress} />
          </div>
        </div>
      </div>

      {/* Import */}
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 7, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px' }}>
          <div style={sectionLabelStyle}>// IMPORT</div>
          {importSuccessMessage && (
            <p style={{ fontSize: 11, color: 'var(--c-green)', marginBottom: 10 }}>{importSuccessMessage}</p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 12, color: 'var(--c-text)' }}>Restore a backup</div>
              <div style={{ fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.4 }}>Merges with existing data. Imported records win on conflict.</div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                style={{ ...secondaryButtonStyle, alignSelf: 'flex-start', marginTop: 4, opacity: isImporting ? 0.4 : 1 }}
              >
                {isImporting ? 'Importing…' : 'Choose backup file…'}
              </button>
              <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 10, borderTop: '1px solid var(--c-border)' }}>
              <div style={{ fontSize: 12, color: 'var(--c-text)' }}>Import a lesson</div>
              <div style={{ fontSize: 10, color: 'var(--c-text3)', lineHeight: 1.4 }}>Load a single lesson JSON file for local study.</div>
              <button
                onClick={() => lessonFileInputRef.current?.click()}
                disabled={isImporting}
                style={{ ...secondaryButtonStyle, alignSelf: 'flex-start', marginTop: 4, opacity: isImporting ? 0.4 : 1 }}
              >
                {isImporting ? 'Importing…' : 'Choose lesson file…'}
              </button>
              <input ref={lessonFileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportLesson} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ExportButton({
  label,
  description,
  onClick,
}: {
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--c-raised)', border: '1px solid var(--c-border)', borderRadius: 5,
        padding: '10px 12px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', width: '100%',
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: 'var(--c-text)' }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: 2 }}>{description}</div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>↓</span>
    </button>
  )
}
