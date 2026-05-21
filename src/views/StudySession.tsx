// StudySession.tsx — hosts the active card loop; drives LessonEngine through the session queue.

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LessonEngine } from '@/components/LessonEngine'
import { startSession, getCardAndContext, completeCard, undoLastRating } from '@/services/sessionService'
import { OFFICIAL_SOURCE_ID } from '@/services/sourceManager'
import {
  useSessionStore,
  selectCurrentQueueItem,
  selectProgressCurrent,
  selectProgressTotal,
  selectIsSessionComplete,
} from '@/stores/sessionStore'
import { useUIStore, useErrorStore } from '@/stores/uiStore'
import type { LessonCard, LessonContext, CardRow, SessionSummary } from '@/lib/types'

export function StudySession() {
  const navigate = useNavigate()
  const scope = useUIStore(state => state.scope)
  const showError = useErrorStore(state => state.show)

  const sessionStart = useSessionStore(state => state.startSession)
  const advanceQueue = useSessionStore(state => state.advanceQueue)
  const undoLast = useSessionStore(state => state.undoLast)
  const endSession = useSessionStore(state => state.endSession)
  const clearSession = useSessionStore(state => state.clearSession)
  const currentItem = useSessionStore(selectCurrentQueueItem)
  const progressCurrent = useSessionStore(selectProgressCurrent)
  const progressTotal = useSessionStore(selectProgressTotal)
  const isComplete = useSessionStore(selectIsSessionComplete)
  const summary = useSessionStore(state => state.summary)
  const lastCompleted = useSessionStore(state => state.lastCompleted)

  const [loading, setLoading] = useState(true)
  const [cardData, setCardData] = useState<{
    card: LessonCard
    cardRow: CardRow
    context: LessonContext
    componentBundleUrl?: string
  } | null>(null)

  useEffect(() => {
    async function init() {
      try {
        setLoading(true)
        // If a pre-seeded queue already exists (started via "Study this lesson"), use it as-is.
        if (!useSessionStore.getState().isActive) {
          const queue = await startSession(scope)
          sessionStart(queue)
        }
      } catch (e) {
        showError(String(e))
      } finally {
        setLoading(false)
      }
    }
    void init()
    return () => clearSession()
  // Intentional empty dep array: session forms once on mount; scope changes take effect at next session start.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // Always clear stale card data immediately — prevents a brief flash of the old card's
    // renderer while the new card loads, which could confuse Playwright's or() locator.
    setCardData(null)
    if (!currentItem) return
    let isCancelled = false
    async function load() {
      try {
        const data = await getCardAndContext(currentItem!)
        if (!isCancelled) setCardData(data)
      } catch (e) {
        if (!isCancelled) showError(String(e))
      }
    }
    void load()
    return () => { isCancelled = true }
  }, [currentItem, showError])

  function handleComplete(result: { rating: 1 | 2 | 3 | 4 }) {
    if (!currentItem || !cardData) return
    completeCard(currentItem, cardData.cardRow, result.rating).catch(e => showError(String(e)))
    advanceQueue(result.rating, currentItem, cardData.cardRow)
  }

  function handleUndo() {
    const last = undoLast()
    if (!last) return
    undoLastRating(last.item, last.previousCardRow).catch(e => showError(String(e)))
  }

  function handleEnd() {
    endSession()
  }

  function handleExit() {
    clearSession()
    navigate('/')
  }

  if (loading) {
    return (
      <PageShell onExit={handleExit}>
        <p style={{ fontSize: 12, color: 'var(--c-text3)' }}>Building queue…</p>
      </PageShell>
    )
  }

  if (progressTotal === 0) {
    return (
      <PageShell onExit={handleExit}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 12, color: 'var(--c-text2)' }}>Nothing due right now. Great work!</p>
          <button
            onClick={handleExit}
            style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--c-accent)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Back to dashboard
          </button>
        </div>
      </PageShell>
    )
  }

  if (summary) {
    return (
      <PageShell onExit={handleExit}>
        <Summary summary={summary} onExit={handleExit} />
      </PageShell>
    )
  }

  if (isComplete) {
    return (
      <PageShell onExit={handleExit}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--c-text2)' }}>Session complete!</p>
          <button
            onClick={handleEnd}
            style={{ padding: '9px 20px', background: 'none', border: '1px solid var(--c-green)', borderRadius: 5, fontSize: 11, color: 'var(--c-green)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            See summary
          </button>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell onExit={handleExit} onUndo={lastCompleted ? handleUndo : undefined}>
      <ProgressBar current={progressCurrent} total={progressTotal} />
      {cardData ? (
        <LessonEngine
          key={`${currentItem?.sourceId}|${currentItem?.lessonId}|${currentItem?.cardId}`}
          card={cardData.card}
          context={cardData.context}
          componentBundleUrl={cardData.componentBundleUrl}
          isTrustedSource={currentItem?.sourceId === OFFICIAL_SOURCE_ID}
          onComplete={handleComplete}
        />
      ) : (
        <p style={{ fontSize: 12, color: 'var(--c-text3)' }}>Loading card…</p>
      )}
    </PageShell>
  )
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total === 0 ? 0 : (current / total) * 100
  return (
    <div
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Card ${current} of ${total}`}
      style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 10 }}
    >
      <div style={{ flex: 1, height: 10, borderRadius: 3, background: 'var(--c-raised)', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'repeating-linear-gradient(-45deg, var(--c-accent) 0, var(--c-accent) 4px, transparent 4px, transparent 8px)',
        }} />
      </div>
      <span style={{ color: 'var(--c-text3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{current}/{total}</span>
    </div>
  )
}

function Summary({ summary, onExit }: { summary: SessionSummary; onExit: () => void }) {
  const ratingLabels: Record<1 | 2 | 3 | 4, string> = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' }
  const ratingColors: Record<1 | 2 | 3 | 4, string> = {
    1: 'var(--c-red)', 2: 'var(--c-amber)', 3: 'var(--c-green)', 4: 'var(--c-accent)',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, alignItems: 'center' }}>
      <span style={{ fontSize: 28, color: 'var(--c-green)', lineHeight: 1 }}>✓</span>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 16, color: 'var(--c-text)', fontWeight: 500 }}>Session complete</div>
        <div style={{ fontSize: 11, color: 'var(--c-text2)', marginTop: 4 }}>{summary.total} cards reviewed</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%' }}>
        {([1, 2, 3, 4] as const).map(r => (
          <div key={r} style={{ background: 'var(--c-raised)', border: '1px solid var(--c-border)', borderRadius: 5, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: ratingColors[r] }}>{ratingLabels[r]}</span>
            <span style={{ fontSize: 11, color: 'var(--c-text)' }}>{summary.ratings[r]}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onExit}
        style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid var(--c-border)', borderRadius: 5, fontSize: 11, color: 'var(--c-text2)', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Back to dashboard
      </button>
    </div>
  )
}

function PageShell({
  children,
  onExit,
  onUndo,
}: {
  children: React.ReactNode
  onExit: () => void
  onUndo?: () => void
}) {
  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 512, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--c-text2)', fontWeight: 500 }}>Study</span>
        <div style={{ display: 'flex', gap: 14 }}>
          {onUndo && (
            <button
              onClick={onUndo}
              style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--c-text3)', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              undo
            </button>
          )}
          <button
            onClick={onExit}
            style={{ background: 'none', border: 'none', fontSize: 10, color: 'var(--c-text3)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            exit
          </button>
        </div>
      </div>
      {children}
    </div>
  )
}
