// LessonEngine.tsx — isolated card renderer. No knowledge of FSRS, sessions, or the DB.
// Receives one card + lesson context; fires onComplete when the user submits a self-rating.
// Dynamically loads custom renderer bundles if the lesson declares one (D1).

import React, { useState, useEffect, useRef } from 'react'
import type { LessonCard, LessonContext, MultipleChoiceCard, FillInBlankCard, FreeTextCard } from '@/lib/types'
import { BUNDLE_CACHE_NAME } from '@/lib/types'

/** Contract that a custom renderer bundle's default export must satisfy. */
interface CustomRendererProps {
  card: LessonCard
  context: LessonContext
  onComplete: (result: { rating: 1 | 2 | 3 | 4 }) => void
}

interface LessonEngineProps {
  card: LessonCard
  context: LessonContext
  /** Absolute URL to a pre-cached ES module exporting a default React component (D1). */
  componentBundleUrl?: string
  onComplete: (result: { rating: 1 | 2 | 3 | 4 }) => void
}

const RATINGS: Array<{ value: 1 | 2 | 3 | 4; label: string; sub: string; color: string }> = [
  { value: 1, label: 'Again', sub: '<1 min', color: 'border-red-700 text-red-400 hover:bg-red-900/30' },
  { value: 2, label: 'Hard', sub: '<10 min', color: 'border-amber-700 text-amber-400 hover:bg-amber-900/30' },
  { value: 3, label: 'Good', sub: 'few days', color: 'border-emerald-700 text-emerald-400 hover:bg-emerald-900/30' },
  { value: 4, label: 'Easy', sub: 'week+', color: 'border-sky-700 text-sky-400 hover:bg-sky-900/30' },
]

function RatingButtons({ onRate }: { onRate: (r: 1 | 2 | 3 | 4) => void }) {
  return (
    <div className="flex gap-3 justify-center flex-wrap">
      {RATINGS.map(ratingOption => (
        <button
          key={ratingOption.value}
          onClick={() => onRate(ratingOption.value)}
          className={`flex flex-col items-center rounded border px-4 py-2 text-sm transition-colors ${ratingOption.color}`}
        >
          <span className="font-medium">{ratingOption.label}</span>
          <span className="text-xs opacity-60">{ratingOption.sub}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Multiple choice ──────────────────────────────────────────────────────────

function MultipleChoiceRenderer({
  card,
  onComplete,
}: {
  card: MultipleChoiceCard
  onComplete: (r: { rating: 1 | 2 | 3 | 4 }) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const isRevealed = selected !== null

  function handleSelect(idx: number) {
    if (isRevealed) return
    setSelected(idx)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-zinc-100 text-base leading-relaxed">{card.question}</p>
      <ul className="flex flex-col gap-2">
        {card.options.map((option, idx) => {
          let style = 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
          if (isRevealed) {
            if (idx === card.correctIndex) style = 'border-emerald-600 text-emerald-300 bg-emerald-950/40'
            else if (idx === selected) style = 'border-red-700 text-red-300 bg-red-950/40'
            else style = 'border-zinc-800 text-zinc-600'
          }
          return (
            <li key={idx}>
              <button
                onClick={() => handleSelect(idx)}
                className={`w-full rounded border px-4 py-2 text-left text-sm transition-colors ${style}`}
              >
                {option}
              </button>
            </li>
          )
        })}
      </ul>
      {isRevealed && (
        <>
          {card.explanation && (
            <p className="text-sm text-zinc-400 border-l-2 border-zinc-700 pl-3">{card.explanation}</p>
          )}
          <RatingButtons onRate={rating => onComplete({ rating })} />
        </>
      )}
    </div>
  )
}

// ─── Fill in blank ────────────────────────────────────────────────────────────

function FillInBlankRenderer({
  card,
  onComplete,
}: {
  card: FillInBlankCard
  onComplete: (r: { rating: 1 | 2 | 3 | 4 }) => void
}) {
  const [answer, setAnswer] = useState('')
  const [isRevealed, setIsRevealed] = useState(false)

  const parts = card.prompt.split('___')

  function handleReveal(e: React.FormEvent) {
    e.preventDefault()
    setIsRevealed(true)
  }

  const normalise = (text: string) => text.trim().toLowerCase()
  const isCorrect =
    isRevealed &&
    card.acceptedAnswers.some(accepted => normalise(accepted) === normalise(answer))

  return (
    <div className="flex flex-col gap-6">
      <p className="text-zinc-100 text-base leading-relaxed">
        {parts[0]}
        {!isRevealed ? (
          <span className="inline-block border-b border-zinc-500 min-w-24 mx-1" />
        ) : (
          <span className={`mx-1 font-medium ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {answer || '(blank)'}
          </span>
        )}
        {parts[1]}
      </p>
      {!isRevealed ? (
        <form onSubmit={handleReveal} className="flex gap-3">
          <input
            autoFocus
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500"
            placeholder="Your answer…"
          />
          <button
            type="submit"
            className="rounded border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-400"
          >
            Check
          </button>
        </form>
      ) : (
        <>
          {!isCorrect && (
            <p className="text-sm text-zinc-400">
              Accepted: {card.acceptedAnswers.join(' / ')}
            </p>
          )}
          {card.explanation && (
            <p className="text-sm text-zinc-400 border-l-2 border-zinc-700 pl-3">{card.explanation}</p>
          )}
          <RatingButtons onRate={rating => onComplete({ rating })} />
        </>
      )}
    </div>
  )
}

// ─── Free text ────────────────────────────────────────────────────────────────

function FreeTextRenderer({
  card,
  onComplete,
}: {
  card: FreeTextCard
  onComplete: (r: { rating: 1 | 2 | 3 | 4 }) => void
}) {
  const [isRevealed, setIsRevealed] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-zinc-100 text-base leading-relaxed">{card.question}</p>
      {!isRevealed ? (
        <button
          onClick={() => setIsRevealed(true)}
          className="self-start rounded border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-400"
        >
          Show answer
        </button>
      ) : (
        <>
          {card.explanation && (
            <p className="text-sm text-zinc-300 border-l-2 border-zinc-700 pl-3 leading-relaxed">
              {card.explanation}
            </p>
          )}
          <RatingButtons onRate={rating => onComplete({ rating })} />
        </>
      )}
    </div>
  )
}

// ─── Custom bundle loader ─────────────────────────────────────────────────────

/**
 * Loads a custom renderer from the bundle cache (populated by Source Manager during sync).
 * Falls back to returning null — caller renders the default renderer instead.
 */
function useCustomRenderer(componentBundleUrl: string | undefined): {
  CustomRenderer: React.ComponentType<CustomRendererProps> | null
  isLoadingBundle: boolean
} {
  const [CustomRenderer, setCustomRenderer] = useState<React.ComponentType<CustomRendererProps> | null>(null)
  const [isLoadingBundle, setIsLoadingBundle] = useState(!!componentBundleUrl)
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!componentBundleUrl) {
      setIsLoadingBundle(false)
      return
    }

    setIsLoadingBundle(true)
    let cancelled = false

    async function loadBundle() {
      try {
        const cache = await caches.open(BUNDLE_CACHE_NAME)
        const cachedResponse = await cache.match(componentBundleUrl!)
        if (!cachedResponse || cancelled) {
          // Cache miss — bundle wasn't pre-fetched during sync; use default renderer
          if (!cancelled) setIsLoadingBundle(false)
          return
        }

        const blob = await cachedResponse.blob()
        if (cancelled) return

        const objectUrl = URL.createObjectURL(blob)
        objectUrlRef.current = objectUrl

        // @vite-ignore: object URL cannot be statically analyzed — intentional dynamic import
        const mod = await import(/* @vite-ignore */ objectUrl) as { default?: React.ComponentType<CustomRendererProps> }
        if (cancelled) return

        if (typeof mod.default === 'function') {
          setCustomRenderer(() => mod.default as React.ComponentType<CustomRendererProps>)
        } else {
          console.warn('[LessonEngine] Custom bundle did not export a default React component; using default renderer')
        }
      } catch (error) {
        if (!cancelled) console.warn('[LessonEngine] Failed to load custom renderer bundle:', error)
      } finally {
        if (!cancelled) setIsLoadingBundle(false)
      }
    }

    void loadBundle()

    return () => {
      cancelled = true
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [componentBundleUrl])

  return { CustomRenderer, isLoadingBundle }
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export function LessonEngine({ card, context, componentBundleUrl, onComplete }: LessonEngineProps) {
  const { CustomRenderer, isLoadingBundle } = useCustomRenderer(componentBundleUrl)

  const header = (
    <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
      <span>{context.title}</span>
      {context.tags.map(tag => (
        <span key={tag} className="rounded bg-zinc-800 px-2 py-0.5">#{tag}</span>
      ))}
    </div>
  )

  if (isLoadingBundle) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-6">
          <p className="text-zinc-500 text-sm">Loading renderer…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="rounded border border-zinc-800 bg-zinc-900 p-6">
        {CustomRenderer ? (
          <CustomRenderer card={card} context={context} onComplete={onComplete} />
        ) : (
          <>
            {card.type === 'multiple-choice' && (
              <MultipleChoiceRenderer card={card} onComplete={onComplete} />
            )}
            {card.type === 'fill-in-blank' && (
              <FillInBlankRenderer card={card} onComplete={onComplete} />
            )}
            {card.type === 'free-text' && (
              <FreeTextRenderer card={card} onComplete={onComplete} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
