// Dashboard.tsx — landing view with due card count, streak, 7-day forecast, and session quick-start.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDueCardCount, getStreak, getDueForecast } from '@/services/sessionService'
import { getAllSources } from '@/services/sourceManager'
import { useErrorStore, useUIStore } from '@/stores/uiStore'
import type { SourceRow, SyncStatus } from '@/lib/types'

const DAY_LABELS = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']

export function Dashboard() {
  const navigate = useNavigate()
  const showError = useErrorStore(s => s.show)
  const scope = useUIStore(s => s.scope)
  const syncStatus = useUIStore(s => s.syncStatus)
  const [dueCount, setDueCount] = useState<number | null>(null)
  const [streak, setStreak] = useState<number | null>(null)
  const [forecast, setForecast] = useState<number[] | null>(null)
  const [sources, setSources] = useState<SourceRow[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [due, loadedStreak, loadedForecast, loadedSources] = await Promise.all([
          getDueCardCount(scope),
          getStreak(),
          getDueForecast(scope),
          getAllSources(),
        ])
        setDueCount(due)
        setStreak(loadedStreak)
        setForecast(loadedForecast)
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

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Due now" value={dueCount} />
        <Stat label="Sources" value={sources.length} />
        <Stat label="Streak" value={streak} suffix={streak === 1 ? ' day' : ' days'} />
      </div>

      <button
        onClick={() => navigate('/study')}
        className="rounded border border-sky-700 bg-sky-950/40 px-6 py-3 text-sky-300 text-sm hover:bg-sky-900/40 transition-colors"
      >
        Start study session →
      </button>

      {forecast && <DueForecast forecast={forecast} />}

      {sources.length > 0 && (
        <SourceHealthPanel sources={sources} syncStatus={syncStatus} />
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  suffix = '',
}: {
  label: string
  value: number | null
  suffix?: string
}) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className="text-2xl text-zinc-100 font-medium">
        {value === null ? '—' : value}
        {value !== null && suffix && <span className="text-sm text-zinc-500 font-normal">{suffix}</span>}
      </div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  )
}

function DueForecast({ forecast }: { forecast: number[] }) {
  const max = Math.max(...forecast, 1)
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex flex-col gap-3">
      <p className="text-xs text-zinc-500 font-medium">Due this week</p>
      <div className="flex gap-1.5 items-end h-16">
        {forecast.map((count, i) => {
          const heightPct = Math.round((count / max) * 100)
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-zinc-500">{count > 0 ? count : ''}</span>
              <div
                className={`w-full rounded-sm ${i === 0 ? 'bg-sky-600' : 'bg-zinc-700'}`}
                style={{ height: `${Math.max(heightPct, count > 0 ? 8 : 2)}%` }}
              />
              <span className="text-[9px] text-zinc-600 truncate w-full text-center">
                {DAY_LABELS[i]}
              </span>
            </div>
          )
        })}
      </div>
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
  if (status === 'syncing') return <span className="text-xs text-sky-400 shrink-0">syncing…</span>
  if (status === 'error') return <span className="text-xs text-red-400 shrink-0">error</span>
  if (status === 'done') return <span className="text-xs text-emerald-400 shrink-0">up to date</span>

  if (source.lastSynced !== undefined) {
    const date = new Date(source.lastSynced).toLocaleDateString()
    return <span className="text-xs text-zinc-400 shrink-0">{date}</span>
  }

  return <span className="text-xs text-zinc-400 shrink-0">never synced</span>
}
