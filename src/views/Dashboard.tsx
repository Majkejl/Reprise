// Dashboard.tsx — landing view with due card count, streak, 7-day forecast, and session quick-start.

import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDueCardCount, getStreak, getDueForecast } from '@/services/sessionService'
import { getAllSources } from '@/services/sourceManager'
import { useErrorStore, useUIStore } from '@/stores/uiStore'
import type { SourceRow, SyncStatus } from '@/lib/types'

const DAY_LABELS = ['Today', 'Tmrw', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']

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
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 512, margin: '0 auto' }}>
      <div>
        <div style={{ fontSize: 20, color: 'var(--c-text)', fontWeight: 500, letterSpacing: '-0.01em' }}>Reprise</div>
        <div style={{ fontSize: 11, color: 'var(--c-text3)', marginTop: 3 }}>spaced-repetition revision</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <StatCard label="DUE NOW" value={dueCount} accentColor="var(--c-accent)" />
        <StatCard label="SOURCES" value={sources.length} accentColor="var(--c-text3)" />
        <StatCard label="STREAK" value={streak} suffix="d" accentColor="var(--c-amber)" />
      </div>

      <button
        onClick={() => navigate('/study')}
        style={{
          width: '100%', padding: '13px 16px',
          background: 'var(--c-accent)', border: 'none', borderRadius: 6,
          color: '#07090f', fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', letterSpacing: '0.01em',
        }}
      >
        <span>$ start study session</span>
        <span style={{ opacity: 0.4, fontWeight: 300 }}>→</span>
      </button>

      {forecast && <DueForecast forecast={forecast} />}

      {sources.length > 0 && (
        <SourceHealthPanel sources={sources} syncStatus={syncStatus} />
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--c-text3)', letterSpacing: '0.07em', marginBottom: 6, fontStyle: 'italic' }}>
      {'// '}{children}
    </div>
  )
}

function StatCard({
  label,
  value,
  suffix,
  accentColor,
}: {
  label: string
  value: number | null
  suffix?: string
  accentColor: string
}) {
  return (
    <div style={{
      background: 'var(--c-surface)', border: '1px solid var(--c-border)',
      borderTop: `2px solid ${accentColor}`, borderRadius: 7, padding: '12px 14px',
    }}>
      <div style={{ fontSize: 26, fontWeight: 500, color: 'var(--c-text)', lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 3 }}>
        {value === null ? '—' : value}
        {value !== null && suffix && (
          <span style={{ fontSize: 11, color: 'var(--c-text3)' }}>{suffix}</span>
        )}
      </div>
      <div style={{ fontSize: 9, color: 'var(--c-text3)', marginTop: 6, letterSpacing: '0.07em' }}>{label}</div>
    </div>
  )
}

function DueForecast({ forecast }: { forecast: number[] }) {
  const max = Math.max(...forecast, 1)
  return (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 7, padding: '14px 16px' }}>
      <SectionLabel>DUE THIS WEEK</SectionLabel>
      <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', height: 72, marginTop: 8 }}>
        {forecast.map((count, i) => {
          const heightPct = Math.max((count / max) * 100, count > 0 ? 8 : 2)
          const isToday = i === 0
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
              {count > 0 && (
                <span style={{ fontSize: 9, color: isToday ? 'var(--c-accent)' : 'var(--c-text3)' }}>{count}</span>
              )}
              <div style={{
                width: '100%', borderRadius: '3px 3px 1px 1px',
                background: isToday ? 'var(--c-accent)' : 'var(--c-raised)',
                height: `${heightPct}%`, minHeight: 2,
                border: `1px solid ${isToday ? 'color-mix(in srgb, var(--c-accent) 50%, transparent)' : 'var(--c-border)'}`,
                boxShadow: isToday ? '0 0 10px color-mix(in srgb, var(--c-accent) 10%, transparent)' : 'none',
              }} />
              <span style={{ fontSize: 8, color: 'var(--c-text3)', width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 7, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <SectionLabel>SOURCE HEALTH</SectionLabel>
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none', margin: 0, padding: 0 }}>
        {sources.map(source => {
          const status = syncStatus[source.sourceId] ?? 'idle'
          return (
            <li key={source.sourceId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--c-text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source.label}</span>
              <SourceStatusIndicator source={source} status={status} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SourceStatusIndicator({ source, status }: { source: SourceRow; status: SyncStatus }) {
  if (status === 'syncing') return <span style={{ fontSize: 10, color: 'var(--c-accent)', flexShrink: 0 }}>syncing…</span>
  if (status === 'error') return <span style={{ fontSize: 10, color: 'var(--c-red)', flexShrink: 0 }}>error</span>
  if (status === 'done') return <span style={{ fontSize: 10, color: 'var(--c-green)', flexShrink: 0 }}>● up to date</span>

  if (source.lastSynced !== undefined) {
    const date = new Date(source.lastSynced).toLocaleDateString()
    return <span style={{ fontSize: 10, color: 'var(--c-green)', flexShrink: 0 }}>● {date}</span>
  }

  return <span style={{ fontSize: 10, color: 'var(--c-text3)', flexShrink: 0 }}>never synced</span>
}
