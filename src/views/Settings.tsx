// Settings.tsx — session preferences, full data export, and local lesson import.

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { exportFull, exportProgress, importData, importLocalLesson, downloadBlob } from '@/services/exportImportService'
import { SettingsRepo } from '@/db'
import { useErrorStore } from '@/stores/uiStore'
import { DEFAULT_SESSION_CAP } from '@/lib/types'

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
    <div className="px-4 py-8 max-w-lg mx-auto flex flex-col gap-10">
      <h1 className="text-xl text-zinc-100 font-medium tracking-tight">Settings</h1>

      <section className="flex flex-col gap-4">
        <p className="text-xs text-zinc-400 font-medium">Session</p>
        <div className="flex items-center gap-4">
          <label htmlFor="session-cap" className="text-sm text-zinc-300 w-40">Cards per session</label>
          <input
            id="session-cap"
            type="number"
            min={1}
            max={200}
            value={sessionCap}
            onChange={e => handleSessionCapChange(Number(e.target.value))}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 w-20 focus:outline-none focus:border-zinc-500"
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <p className="text-xs text-zinc-400 font-medium">Export</p>
        <div className="flex flex-col gap-2">
          <ExportButton label="Full export" description="All lessons, progress, history" onClick={handleExportFull} />
          <ExportButton label="Progress only" description="Card states + settings, no lesson content" onClick={handleExportProgress} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <p className="text-xs text-zinc-400 font-medium">Import</p>
        {importSuccessMessage && (
          <p className="text-xs text-emerald-400">{importSuccessMessage}</p>
        )}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-zinc-300">Restore a backup</p>
            <p className="text-xs text-zinc-600">Merges with existing data. Imported records win on conflict.</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="self-start mt-1 text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-40 transition-colors"
            >
              {isImporting ? 'Importing…' : 'Choose backup file…'}
            </button>
            <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
          </div>

          <div className="flex flex-col gap-1 pt-3 border-t border-zinc-800">
            <p className="text-sm text-zinc-300">Import a lesson</p>
            <p className="text-xs text-zinc-600">Load a single lesson JSON file for local study.</p>
            <button
              onClick={() => lessonFileInputRef.current?.click()}
              disabled={isImporting}
              className="self-start mt-1 text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-40 transition-colors"
            >
              {isImporting ? 'Importing…' : 'Choose lesson file…'}
            </button>
            <input ref={lessonFileInputRef} type="file" accept=".json" className="hidden" onChange={handleImportLesson} />
          </div>
        </div>
      </section>
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
      className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-left hover:border-zinc-600 transition-colors group"
    >
      <div>
        <p className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors">{label}</p>
        <p className="text-xs text-zinc-600 mt-0.5">{description}</p>
      </div>
      <span className="text-zinc-600 text-xs group-hover:text-zinc-400 transition-colors">↓</span>
    </button>
  )
}
