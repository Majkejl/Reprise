// Sources.tsx — register, remove, and manually sync lesson sources.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  getAllSources,
  syncSource,
  syncAll,
  registerSource,
  removeSource,
  OFFICIAL_SOURCE_ID,
  type SyncProgressCallback,
} from '@/services/sourceManager'
import { useUIStore, useErrorStore } from '@/stores/uiStore'
import type { SourceRow, SyncStatus } from '@/lib/types'

export function Sources() {
  const [sources, setSources] = useState<SourceRow[]>([])
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [newSourceLabel, setNewSourceLabel] = useState('')
  const [isSyncingAll, setIsSyncingAll] = useState(false)

  const syncStatus = useUIStore(s => s.syncStatus)
  const setSyncStatus = useUIStore(s => s.setSyncStatus)
  const showError = useErrorStore(s => s.show)

  const loadSources = useCallback(async () => {
    try {
      setSources(await getAllSources())
    } catch (e) {
      showError(String(e))
    }
  }, [showError])

  useEffect(() => {
    void loadSources()
  }, [loadSources])

  const handleSyncSource = async (sourceId: string) => {
    const onProgress: SyncProgressCallback = (id, status) => setSyncStatus(id, status)
    try {
      await syncSource(sourceId, onProgress)
    } catch (e) {
      showError(String(e))
    }
  }

  const handleSyncAll = async () => {
    setIsSyncingAll(true)
    const onProgress: SyncProgressCallback = (id, status) => setSyncStatus(id, status)
    try {
      await syncAll(onProgress)
    } catch (e) {
      showError(String(e))
    } finally {
      setIsSyncingAll(false)
    }
  }

  const handleAddSource = async (e: FormEvent) => {
    e.preventDefault()
    if (!newSourceUrl.trim()) return
    try {
      await registerSource(newSourceUrl.trim(), newSourceLabel.trim())
      setNewSourceUrl('')
      setNewSourceLabel('')
      await loadSources()
    } catch (e) {
      showError(String(e))
    }
  }

  const handleRemoveSource = async (sourceId: string) => {
    try {
      await removeSource(sourceId)
      await loadSources()
    } catch (e) {
      showError(String(e))
    }
  }

  return (
    <div className="px-4 py-8 max-w-lg mx-auto flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl text-zinc-100 font-medium tracking-tight">Sources</h1>
        <button
          onClick={handleSyncAll}
          disabled={isSyncingAll || sources.length === 0}
          className="text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-40 transition-colors"
        >
          {isSyncingAll ? 'Syncing…' : 'Sync all'}
        </button>
      </div>

      <p className="text-xs text-zinc-600 -mt-6">
        Sync is append-only — removing a lesson from a source repo does not remove it from your device.
      </p>

      <ul className="flex flex-col gap-3">
        {sources.length === 0 && (
          <li className="text-zinc-500 text-sm">No sources registered.</li>
        )}
        {sources.map(source => (
          <SourceListItem
            key={source.sourceId}
            source={source}
            status={syncStatus[source.sourceId] ?? 'idle'}
            isOfficial={source.sourceId === OFFICIAL_SOURCE_ID}
            onSync={() => handleSyncSource(source.sourceId)}
            onRemove={() => handleRemoveSource(source.sourceId)}
          />
        ))}
      </ul>

      <form onSubmit={handleAddSource} className="flex flex-col gap-2 pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-500 font-medium">Add a lesson source</p>
        <input
          type="url"
          placeholder="https://example.com/lessons/"
          value={newSourceUrl}
          onChange={e => setNewSourceUrl(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <input
          type="text"
          placeholder="Label (optional)"
          value={newSourceLabel}
          onChange={e => setNewSourceLabel(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={!newSourceUrl.trim()}
          className="self-start text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-40 transition-colors"
        >
          Add source
        </button>
      </form>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface SourceListItemProps {
  source: SourceRow
  status: SyncStatus
  isOfficial: boolean
  onSync: () => void
  onRemove: () => void
}

function SourceListItem({ source, status, isOfficial, onSync, onRemove }: SourceListItemProps) {
  const isSyncing = status === 'syncing'

  return (
    <li className="rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-200 truncate">{source.label}</span>
          {isOfficial ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-900 shrink-0">
              official
            </span>
          ) : (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700 shrink-0">
              user
            </span>
          )}
          <SyncStatusBadge status={status} />
        </div>
        {source.lastSynced !== undefined ? (
          <span className="text-xs text-zinc-600">
            Last synced {new Date(source.lastSynced).toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-zinc-700">Never synced</span>
        )}
        {source.url && (
          <span className="text-xs text-zinc-700 truncate">{source.url}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-40 transition-colors"
        >
          {isSyncing ? 'Syncing…' : 'Sync'}
        </button>
        {!isOfficial && (
          <button
            onClick={onRemove}
            disabled={isSyncing}
            className="text-xs px-2 py-1 rounded border border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-900 disabled:opacity-40 transition-colors"
          >
            Remove
          </button>
        )}
      </div>
    </li>
  )
}

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  if (status === 'idle') return null
  const styles: Record<string, string> = {
    syncing: 'text-sky-400',
    done: 'text-emerald-400',
    error: 'text-red-400',
  }
  const labels: Record<string, string> = {
    syncing: 'syncing…',
    done: 'up to date',
    error: 'error',
  }
  return (
    <span className={`text-[10px] ${styles[status] ?? ''}`}>
      {labels[status] ?? status}
    </span>
  )
}
