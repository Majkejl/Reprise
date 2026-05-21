// LessonEngine.tsx — isolated card renderer. No knowledge of FSRS, sessions, or the DB.
// Receives one card + lesson context; fires onComplete when the user submits a self-rating.
// Dynamically loads custom renderer bundles if the lesson declares one (D1).
// Third-party (untrusted) bundles run in a sandboxed iframe; official-source bundles run directly (D4).

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
  /**
   * Whether the card's source is trusted (e.g. the official source). Trusted bundles are
   * imported directly; untrusted bundles run in a sandboxed iframe (D4).
   * Defaults to true for backward compatibility.
   */
  isTrustedSource?: boolean
  onComplete: (result: { rating: 1 | 2 | 3 | 4 }) => void
}

const RATINGS: Array<{ value: 1 | 2 | 3 | 4; label: string; sub: string; color: string }> = [
  { value: 1, label: 'Again', sub: '<1 min', color: 'border-red-700 text-red-400 hover:bg-red-900/30' },
  { value: 2, label: 'Hard', sub: '<10 min', color: 'border-amber-700 text-amber-400 hover:bg-amber-900/30' },
  { value: 3, label: 'Good', sub: 'few days', color: 'border-emerald-700 text-emerald-400 hover:bg-emerald-900/30' },
  { value: 4, label: 'Easy', sub: 'week+', color: 'border-sky-700 text-sky-400 hover:bg-sky-900/30' },
]

function RatingButtons({ onRate }: { onRate: (r: 1 | 2 | 3 | 4) => void }) {
  const onRateRef = useRef(onRate)
  useEffect(() => { onRateRef.current = onRate })

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const num = Number(e.key)
      if (num >= 1 && num <= 4) onRateRef.current(num as 1 | 2 | 3 | 4)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

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
          <span className="text-xs opacity-30 mt-0.5">[{ratingOption.value}]</span>
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isRevealed) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const num = Number(e.key)
      if (num >= 1 && num <= card.options.length) setSelected(num - 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRevealed, card.options.length])

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
                <span className="opacity-40 mr-2 select-none">{idx + 1}.</span>{option}
              </button>
            </li>
          )
        })}
      </ul>
      {isRevealed && (
        <div role="status">
          {card.explanation && (
            <p className="text-sm text-zinc-400 border-l-2 border-zinc-700 pl-3 mb-6">{card.explanation}</p>
          )}
          <RatingButtons onRate={rating => onComplete({ rating })} />
        </div>
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
            aria-label="Your answer"
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

// ─── Default card content ─────────────────────────────────────────────────────

/** Renders the built-in card type renderers. Used as the fallback for both trusted and sandboxed paths. */
function DefaultCardContent({
  card,
  onComplete,
}: {
  card: LessonCard
  onComplete: (r: { rating: 1 | 2 | 3 | 4 }) => void
}) {
  if (card.type === 'multiple-choice') return <MultipleChoiceRenderer card={card} onComplete={onComplete} />
  if (card.type === 'fill-in-blank') return <FillInBlankRenderer card={card} onComplete={onComplete} />
  if (card.type === 'free-text') return <FreeTextRenderer card={card} onComplete={onComplete} />
  return null
}

// ─── Custom bundle loader (trusted / official source) ─────────────────────────

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

// ─── Sandboxed bundle renderer (third-party sources) ─────────────────────────

interface CompleteMessage {
  type: 'reprise:complete'
  rating: 1 | 2 | 3 | 4
}

function isCompleteMessage(data: unknown): data is CompleteMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === 'reprise:complete' &&
    [1, 2, 3, 4].includes((data as Record<string, unknown>).rating as number)
  )
}

/** Encodes a string to base64 via UTF-8, safe for non-ASCII characters in bundle code. */
function toUtf8Base64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('')
  return btoa(binary)
}

/**
 * Builds an HTML document string for srcdoc-based sandboxed rendering.
 * The bundle code is base64/UTF-8 encoded to safely embed it without </script> injection risk.
 * Card and context JSON has < escaped to < for the same reason.
 * The bundle is expected to read window.__repriseData__ and call window.__repriseComplete__(rating).
 */
function buildSandboxDocument(card: LessonCard, context: LessonContext, bundleCode: string): string {
  const safeCard = JSON.stringify(card).replace(/</g, '\\u003c')
  const safeContext = JSON.stringify(context).replace(/</g, '\\u003c')
  const encodedBundle = toUtf8Base64(bundleCode)

  // postMessage target is '*' because the sandboxed iframe has an opaque origin and cannot
  // know the parent's origin — acceptable given sandbox="allow-scripts" containment (D4).
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<script>' +
    `window.__repriseData__={card:${safeCard},context:${safeContext}};` +
    `window.__repriseComplete__=function(r){window.parent.postMessage({type:"reprise:complete",rating:r},"*");};` +
    '(function(){' +
    `var b=atob(${JSON.stringify(encodedBundle)});` +
    'var a=new Uint8Array(b.length);' +
    'for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);' +
    'var s=document.createElement("script");' +
    's.textContent=new TextDecoder().decode(a);' +
    'document.head.appendChild(s);' +
    '}());' +
    '<' + '/script>' +
    '</head><body></body></html>'
  )
}

function SandboxedBundleFrame({
  componentBundleUrl,
  card,
  context,
  onComplete,
  fallback,
}: {
  componentBundleUrl: string
  card: LessonCard
  context: LessonContext
  onComplete: (r: { rating: 1 | 2 | 3 | 4 }) => void
  fallback: React.ReactNode
}) {
  const [srcdoc, setSrcdoc] = useState<string | null>(null)
  const [isLoadingBundle, setIsLoadingBundle] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  useEffect(() => {
    let cancelled = false

    async function buildDoc() {
      try {
        const cache = await caches.open(BUNDLE_CACHE_NAME)
        const cachedResponse = await cache.match(componentBundleUrl)
        if (!cachedResponse) {
          if (!cancelled) { setLoadFailed(true); setIsLoadingBundle(false) }
          return
        }
        const bundleCode = await cachedResponse.text()
        if (cancelled) return
        const doc = buildSandboxDocument(card, context, bundleCode)
        if (!cancelled) { setSrcdoc(doc); setIsLoadingBundle(false) }
      } catch {
        if (!cancelled) { setLoadFailed(true); setIsLoadingBundle(false) }
      }
    }

    void buildDoc()
    return () => { cancelled = true }
  }, [componentBundleUrl, card, context])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // Only accept messages from this specific iframe to prevent spoofing
      if (event.source !== iframeRef.current?.contentWindow) return
      if (!isCompleteMessage(event.data)) return
      onComplete({ rating: event.data.rating })
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onComplete])

  if (isLoadingBundle) {
    return <p className="text-zinc-500 text-sm">Loading renderer…</p>
  }

  if (loadFailed || !srcdoc) {
    return <>{fallback}</>
  }

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-scripts"
      srcDoc={srcdoc}
      className="w-full border-0 block"
      style={{ minHeight: '400px' }}
      title="Custom card renderer (sandboxed)"
    />
  )
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export function LessonEngine({
  card,
  context,
  componentBundleUrl,
  isTrustedSource = true,
  onComplete,
}: LessonEngineProps) {
  // Pass the bundle URL to useCustomRenderer only for trusted sources; undefined is a no-op.
  const { CustomRenderer, isLoadingBundle } = useCustomRenderer(
    isTrustedSource ? componentBundleUrl : undefined,
  )

  const header = (
    <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
      <span>{context.title}</span>
      {context.tags.map(tag => (
        <span key={tag} className="rounded bg-zinc-800 px-2 py-0.5">#{tag}</span>
      ))}
    </div>
  )

  // Untrusted source with a bundle — run it isolated in a sandboxed iframe (D4).
  if (!isTrustedSource && componentBundleUrl) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="rounded border border-zinc-800 bg-zinc-900 p-6">
          <SandboxedBundleFrame
            componentBundleUrl={componentBundleUrl}
            card={card}
            context={context}
            onComplete={onComplete}
            fallback={<DefaultCardContent card={card} onComplete={onComplete} />}
          />
        </div>
      </div>
    )
  }

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
          <DefaultCardContent card={card} onComplete={onComplete} />
        )}
      </div>
    </div>
  )
}
