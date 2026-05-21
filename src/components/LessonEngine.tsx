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

const RATINGS: Array<{ value: 1 | 2 | 3 | 4; label: string; sub: string; color: string; bg: string }> = [
  { value: 1, label: 'Again', sub: '<1m',   color: 'var(--c-red)',    bg: 'color-mix(in srgb, var(--c-red) 10%, transparent)'    },
  { value: 2, label: 'Hard',  sub: '<10m',  color: 'var(--c-amber)',  bg: 'color-mix(in srgb, var(--c-amber) 10%, transparent)'  },
  { value: 3, label: 'Good',  sub: 'days',  color: 'var(--c-green)',  bg: 'color-mix(in srgb, var(--c-green) 10%, transparent)'  },
  { value: 4, label: 'Easy',  sub: 'week+', color: 'var(--c-accent)', bg: 'color-mix(in srgb, var(--c-accent) 10%, transparent)' },
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
    <div style={{ display: 'flex', gap: 5 }}>
      {RATINGS.map(r => (
        <button
          key={r.value}
          onClick={() => onRate(r.value)}
          style={{
            flex: 1, padding: '7px 4px',
            background: r.bg,
            border: `1px solid color-mix(in srgb, ${r.color} 25%, transparent)`,
            borderBottom: `2px solid color-mix(in srgb, ${r.color} 45%, transparent)`,
            borderRadius: 5, color: r.color, fontFamily: 'inherit', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 11 }}>{r.label}</span>
          <span style={{ fontSize: 9, opacity: 0.5 }}>{r.sub}</span>
          <span style={{ fontSize: 8, opacity: 0.3 }}>[{r.value}]</span>
        </button>
      ))}
    </div>
  )
}

// ─── Explanation toggle ───────────────────────────────────────────────────────

/** Collapsible hint/explanation panel. Visible before and after answering. */
function ExplanationToggle({ text }: { text: string }) {
  const [isVisible, setIsVisible] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        onClick={() => setIsVisible(v => !v)}
        style={{
          alignSelf: 'flex-start', padding: '3px 8px', borderRadius: 3, fontSize: 10,
          background: 'none', border: '1px solid var(--c-border)',
          color: 'var(--c-text3)', fontFamily: 'inherit', cursor: 'pointer',
        }}
      >
        {isVisible ? 'hide hint' : 'show hint'}
      </button>
      {isVisible && (
        <div style={{ padding: '10px 12px', background: 'var(--c-raised)', borderLeft: '2px solid var(--c-text3)', borderRadius: '0 4px 4px 0', fontSize: 11, color: 'var(--c-text2)', lineHeight: 1.65 }}>
          {text}
        </div>
      )}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--c-text)', lineHeight: 1.65 }}>{card.question}</p>
      {card.explanation && <ExplanationToggle text={card.explanation} />}
      <ul style={{ display: 'flex', flexDirection: 'column', gap: 5, listStyle: 'none', margin: 0, padding: 0 }}>
        {card.options.map((option, idx) => {
          const isCorrect = isRevealed && idx === card.correctIndex
          const isWrong = isRevealed && idx === selected && selected !== card.correctIndex
          const isDimmed = isRevealed && !isCorrect && !isWrong
          return (
            <li key={idx}>
              <button
                onClick={() => handleSelect(idx)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 5, textAlign: 'left',
                  fontFamily: 'inherit', fontSize: 12, cursor: isRevealed ? 'default' : 'pointer',
                  display: 'flex', gap: 10, alignItems: 'center', transition: 'all 150ms ease',
                  background: isCorrect ? 'color-mix(in srgb, var(--c-green) 10%, transparent)'
                             : isWrong  ? 'color-mix(in srgb, var(--c-red) 10%, transparent)'
                             :             'var(--c-bg)',
                  border: `1px solid ${isCorrect ? 'var(--c-green)' : isWrong ? 'var(--c-red)' : 'var(--c-border)'}`,
                  color: isCorrect ? 'var(--c-green)' : isWrong ? 'var(--c-red)' : isDimmed ? 'var(--c-text3)' : 'var(--c-text2)',
                }}
              >
                <span style={{ fontSize: 9, padding: '2px 5px', borderRadius: 3, background: 'var(--c-raised)', border: '1px solid var(--c-border)', color: 'var(--c-text3)', flexShrink: 0, lineHeight: 1.5 }}>
                  {idx + 1}
                </span>
                <span style={{ flex: 1 }}>{option}</span>
                {isCorrect && <span style={{ fontSize: 10, opacity: 0.8 }}>✓</span>}
                {isWrong   && <span style={{ fontSize: 10, opacity: 0.8 }}>✗</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {isRevealed && (
        <div role="status">
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--c-text)', lineHeight: 1.65 }}>
        {parts[0]}
        {!isRevealed ? (
          <span style={{ display: 'inline-block', borderBottom: '1px solid var(--c-text3)', minWidth: 80, marginInline: 4 }} />
        ) : (
          <span style={{ marginInline: 4, fontWeight: 500, color: isCorrect ? 'var(--c-green)' : 'var(--c-red)' }}>
            {answer || '(blank)'}
          </span>
        )}
        {parts[1]}
      </p>
      {card.explanation && <ExplanationToggle text={card.explanation} />}
      {!isRevealed ? (
        <form onSubmit={handleReveal} style={{ display: 'flex', gap: 8 }}>
          <input
            autoFocus
            aria-label="Your answer"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            style={{ flex: 1, borderRadius: 5, border: '1px solid var(--c-border)', background: 'var(--c-raised)', padding: '8px 12px', fontSize: 12, color: 'var(--c-text)', fontFamily: 'inherit' }}
            placeholder="Your answer…"
          />
          <button
            type="submit"
            style={{ borderRadius: 5, border: '1px solid var(--c-border)', background: 'none', padding: '8px 14px', fontSize: 11, color: 'var(--c-text2)', fontFamily: 'inherit', cursor: 'pointer' }}
          >
            Check
          </button>
        </form>
      ) : (
        <>
          {!isCorrect && (
            <p style={{ fontSize: 11, color: 'var(--c-text3)' }}>
              Accepted: {card.acceptedAnswers.join(' / ')}
            </p>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 13, color: 'var(--c-text)', lineHeight: 1.65 }}>{card.question}</p>
      {card.explanation && <ExplanationToggle text={card.explanation} />}
      {!isRevealed ? (
        <button
          onClick={() => setIsRevealed(true)}
          style={{ alignSelf: 'flex-start', borderRadius: 5, border: '1px solid var(--c-border)', background: 'none', padding: '8px 14px', fontSize: 11, color: 'var(--c-text2)', fontFamily: 'inherit', cursor: 'pointer' }}
        >
          Show answer
        </button>
      ) : (
        <RatingButtons onRate={rating => onComplete({ rating })} />
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

// ─── Tag chip ─────────────────────────────────────────────────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 10, padding: '2px 7px', borderRadius: 3,
      background: 'color-mix(in srgb, var(--c-accent) 12%, transparent)',
      border: '1px solid color-mix(in srgb, var(--c-accent) 20%, transparent)',
      color: 'var(--c-accent)',
    }}>
      {children}
    </span>
  )
}

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

  const titleBar = (
    <div style={{ padding: '8px 12px', background: 'var(--c-raised)', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 10, color: 'var(--c-text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {context.title}
      </span>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {context.tags.map(tag => <Chip key={tag}>{tag}</Chip>)}
      </div>
    </div>
  )

  // Untrusted source with a bundle — run it isolated in a sandboxed iframe (D4).
  if (!isTrustedSource && componentBundleUrl) {
    return (
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, overflow: 'hidden' }}>
        {titleBar}
        <div style={{ padding: '18px 16px' }}>
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
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, overflow: 'hidden' }}>
        {titleBar}
        <div style={{ padding: '18px 16px' }}>
          <p style={{ fontSize: 12, color: 'var(--c-text3)' }}>Loading renderer…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 8, overflow: 'hidden' }}>
      {titleBar}
      <div style={{ padding: '18px 16px' }}>
        {CustomRenderer ? (
          <CustomRenderer card={card} context={context} onComplete={onComplete} />
        ) : (
          <DefaultCardContent card={card} onComplete={onComplete} />
        )}
      </div>
    </div>
  )
}
