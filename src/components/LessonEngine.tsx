import { useState } from 'react'
import type { LessonCard, LessonContext, MultipleChoiceCard, FillInBlankCard, FreeTextCard } from '@/lib/types'

interface LessonEngineProps {
  card: LessonCard
  context: LessonContext
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
      {RATINGS.map(r => (
        <button
          key={r.value}
          onClick={() => onRate(r.value)}
          className={`flex flex-col items-center rounded border px-4 py-2 text-sm transition-colors ${r.color}`}
        >
          <span className="font-medium">{r.label}</span>
          <span className="text-xs opacity-60">{r.sub}</span>
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
  const revealed = selected !== null

  function handleSelect(idx: number) {
    if (revealed) return
    setSelected(idx)
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-zinc-100 text-base leading-relaxed">{card.question}</p>
      <ul className="flex flex-col gap-2">
        {card.options.map((opt, idx) => {
          let style = 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
          if (revealed) {
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
                {opt}
              </button>
            </li>
          )
        })}
      </ul>
      {revealed && (
        <>
          {card.explanation && (
            <p className="text-sm text-zinc-400 border-l-2 border-zinc-700 pl-3">{card.explanation}</p>
          )}
          <RatingButtons onRate={r => onComplete({ rating: r })} />
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
  const [revealed, setReveal] = useState(false)

  const parts = card.prompt.split('___')

  function reveal(e: React.FormEvent) {
    e.preventDefault()
    setReveal(true)
  }

  const normalise = (s: string) => s.trim().toLowerCase()
  const isCorrect =
    revealed &&
    card.acceptedAnswers.some(a => normalise(a) === normalise(answer))

  return (
    <div className="flex flex-col gap-6">
      <p className="text-zinc-100 text-base leading-relaxed">
        {parts[0]}
        {!revealed ? (
          <span className="inline-block border-b border-zinc-500 min-w-24 mx-1" />
        ) : (
          <span className={`mx-1 font-medium ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
            {answer || '(blank)'}
          </span>
        )}
        {parts[1]}
      </p>
      {!revealed ? (
        <form onSubmit={reveal} className="flex gap-3">
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
          <RatingButtons onRate={r => onComplete({ rating: r })} />
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
  const [revealed, setReveal] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-zinc-100 text-base leading-relaxed">{card.question}</p>
      {!revealed ? (
        <button
          onClick={() => setReveal(true)}
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
          <RatingButtons onRate={r => onComplete({ rating: r })} />
        </>
      )}
    </div>
  )
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export function LessonEngine({ card, context, onComplete }: LessonEngineProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-xs text-zinc-600">
        <span>{context.title}</span>
        {context.tags.map(t => (
          <span key={t} className="rounded bg-zinc-800 px-2 py-0.5">#{t}</span>
        ))}
      </div>
      <div className="rounded border border-zinc-800 bg-zinc-900 p-6">
        {card.type === 'multiple-choice' && (
          <MultipleChoiceRenderer card={card} onComplete={onComplete} />
        )}
        {card.type === 'fill-in-blank' && (
          <FillInBlankRenderer card={card} onComplete={onComplete} />
        )}
        {card.type === 'free-text' && (
          <FreeTextRenderer card={card} onComplete={onComplete} />
        )}
      </div>
    </div>
  )
}
