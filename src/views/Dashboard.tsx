// Dashboard.tsx — landing view with due card count, source health, and session quick-start.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDueCardCount } from '@/services/sessionService'
import { getAllSources } from '@/services/sourceManager'
import { useErrorStore, useUIStore } from '@/stores/uiStore'
import type { SourceRow, SyncStatus } from '@/lib/types'

export function Dashboard() {
  const navigate = useNavigate()
  const showError = useErrorStore(s => s.show)
  const scope = useUIStore(s => s.scope)
  const syncStatus = useUIStore(s => s.syncStatus)
  const [dueCount, setDueCount] = useState<number | null>(null)
  const [sources, setSources] = useState<SourceRow[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [due, loadedSources] = await Promise.all([
          getDueCardCount(scope),
          getAllSources(),
        ])
        setDueCount(due)
        setSources(loadedSources)
      } catch (e) {
        showError(String(e))
      }
    }
    void load()
  }, [scope, showError])

  return (
    <div className="flex flex-col gap-8 px-4 py-8 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl text-zinc-100 font-medium tracking-tight">Reprise</h1>
        <p className="text-zinc-500 text-sm mt-1">Spaced-repetition exam revision</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Due now" value={dueCount} />
        <Stat label="Sources" value={sources.length} />
      </div>

      <button
        onClick={() => navigate('/study')}
        className="rounded border border-sky-700 bg-sky-950/40 px-6 py-3 text-sky-300 text-sm hover:bg-sky-900/40 transition-colors"
      >
        Start study session →
      </button>

      {sources.length > 0 && (
        <SourceHealthPanel sources={sources} syncStatus={syncStatus} />
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="text-2xl text-zinc-100 font-medium">
        {value === null ? '—' : value}
      </div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  )
}

function SourceHealthPanel({
  sources,
  syncStatus,
}: {
  sources: SourceRow[]
  syncStatus: Record<string, SyncStatus>
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex flex-col gap-2">
      <p className="text-xs text-zinc-500 font-medium">Source health</p>
      <ul className="flex flex-col gap-1.5">
        {sources.map(source => {
          const status = syncStatus[source.sourceId] ?? 'idle'
          return (
            <li key={source.sourceId} className="flex items-center justify-between gap-4">
              <span className="text-xs text-zinc-400 truncate">{source.label}</span>
              <SourceStatusIndicator source={source} status={status} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SourceStatusIndicator({ source, status }: { source: SourceRow; status: SyncStatus }) {
  if (status === 'syncing') return <span className="text-[10px] text-sky-400 shrink-0">syncing…</span>
  if (status === 'error') return <span className="text-[10px] text-red-400 shrink-0">error</span>
  if (status === 'done') return <span className="text-[10px] text-emerald-400 shrink-0">up to date</span>

  if (source.lastSynced !== undefined) {
    const date = new Date(source.lastSynced).toLocaleDateString()
    return <span className="text-[10px] text-zinc-600 shrink-0">{date}</span>
  }

  return <span className="text-[10px] text-zinc-700 shrink-0">never synced</span>
}
