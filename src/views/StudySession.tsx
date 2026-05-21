// StudySession.tsx — hosts the active card loop; drives LessonEngine through the session queue.

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LessonEngine } from '@/components/LessonEngine'
import { startSession, getCardAndContext, completeCard, undoLastRating } from '@/services/sessionService'
import { SettingsRepo } from '@/db'
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
  const [previewNewCards, setPreviewNewCards] = useState(false)
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
        const storedPreview = await SettingsRepo.get<boolean>('previewNewCards')
        if (storedPreview !== undefined) setPreviewNewCards(storedPreview)

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
    return <PageShell onExit={handleExit}><p className="text-zinc-500 text-sm">Building queue…</p></PageShell>
  }

  if (progressTotal === 0) {
    return (
      <PageShell onExit={handleExit}>
        <div className="text-center text-zinc-400 text-sm flex flex-col gap-4">
          <p>Nothing due right now. Great work!</p>
          <button onClick={handleExit} className="text-sky-400 hover:underline">Back to dashboard</button>
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
        <div className="flex flex-col items-center gap-4">
          <p className="text-zinc-300 text-sm">Session complete!</p>
          <button
            onClick={handleEnd}
            className="rounded border border-emerald-700 px-5 py-2 text-sm text-emerald-400 hover:bg-emerald-900/20"
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
          isNew={currentItem?.isNew ?? false}
          previewMode={previewNewCards}
          onComplete={handleComplete}
        />
      ) : (
        <p className="text-zinc-500 text-sm">Loading card…</p>
      )}
    </PageShell>
  )
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((current / total) * 100)
  return (
    <div
      className="flex items-center gap-3"
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Card ${current} of ${total}`}
    >
      <div className="flex-1 h-1 rounded-full bg-zinc-800">
        <div
          className="h-1 rounded-full bg-sky-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-zinc-500 shrink-0" aria-hidden="true">{current}/{total}</span>
    </div>
  )
}

function Summary({ summary, onExit }: { summary: SessionSummary; onExit: () => void }) {
  const ratingLabels: Record<1 | 2 | 3 | 4, string> = {
    1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy',
  }
  const ratingColors: Record<1 | 2 | 3 | 4, string> = {
    1: 'text-red-400', 2: 'text-amber-400', 3: 'text-emerald-400', 4: 'text-sky-400',
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-zinc-100 text-lg font-medium">Session complete</p>
        <p className="text-zinc-500 text-sm">{summary.total} cards reviewed</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {([1, 2, 3, 4] as const).map(r => (
          <div key={r} className="rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 flex justify-between">
            <span className={`text-sm ${ratingColors[r]}`}>{ratingLabels[r]}</span>
            <span className="text-sm text-zinc-300">{summary.ratings[r]}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onExit}
        className="rounded border border-zinc-700 px-5 py-2 text-sm text-zinc-300 hover:border-zinc-500"
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
    <div className="flex flex-col gap-6 px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <span className="text-zinc-100 text-sm font-medium">Study</span>
        <div className="flex items-center gap-3">
          {onUndo && (
            <button onClick={onUndo} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              Undo
            </button>
          )}
          <button onClick={onExit} className="text-xs text-zinc-600 hover:text-zinc-400">Exit</button>
        </div>
      </div>
      {children}
    </div>
  )
}
