// LessonReader.tsx — read-only view of a lesson's overview and all cards as Q&A pairs.

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getLessonById, getAllCardsForLesson } from '@/services/lessonService'
import { useErrorStore } from '@/stores/uiStore'
import type { LessonRow, CardRow, MultipleChoiceCard, FillInBlankCard, FreeTextCard } from '@/lib/types'

export function LessonReader() {
  const { sourceId, lessonId } = useParams<{ sourceId: string; lessonId: string }>()
  const [lesson, setLesson] = useState<LessonRow | null>(null)
  const [cards, setCards] = useState<CardRow[]>([])
  const showError = useErrorStore(s => s.show)

  useEffect(() => {
    if (!sourceId || !lessonId) return
    async function load() {
      try {
        const [loadedLesson, loadedCards] = await Promise.all([
          getLessonById(decodeURIComponent(sourceId!), decodeURIComponent(lessonId!)),
          getAllCardsForLesson(decodeURIComponent(sourceId!), decodeURIComponent(lessonId!)),
        ])
        if (!loadedLesson) {
          showError('Lesson not found')
          return
        }
        setLesson(loadedLesson)
        setCards(loadedCards)
      } catch (e) {
        showError(String(e))
      }
    }
    void load()
  }, [sourceId, lessonId, showError])

  if (!lesson) {
    return (
      <div className="px-4 py-8 max-w-lg mx-auto">
        <p className="text-zinc-500 text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-8 max-w-lg mx-auto flex flex-col gap-8">
      <div>
        <Link to="/lessons" className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          ← Back to lessons
        </Link>
        <h1 className="text-xl text-zinc-100 font-medium tracking-tight mt-3">{lesson.title}</h1>
        {lesson.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {lesson.tags.map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {lesson.overview && (
        <div className="rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3">
          <p className="text-xs text-zinc-500 font-medium mb-2">Overview</p>
          <p className="text-sm text-zinc-300 leading-relaxed">{lesson.overview}</p>
        </div>
      )}

      {lesson.sources && lesson.sources.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 font-medium mb-2">Sources</p>
          <ul className="flex flex-col gap-1">
            {lesson.sources.map((source, index) => (
              <li key={index} className="text-sm text-zinc-400">
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="hover:text-zinc-200 transition-colors">
                    {source.label}
                  </a>
                ) : (
                  source.label
                )}
                {source.summary && (
                  <span className="text-zinc-600 ml-2">— {source.summary}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <p className="text-xs text-zinc-500 font-medium">{cards.length} card{cards.length !== 1 ? 's' : ''}</p>
        {cards.map((cardRow, index) => (
          <CardQA key={cardRow.cardId} cardRow={cardRow} index={index + 1} />
        ))}
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function CardQA({ cardRow, index }: { cardRow: CardRow; index: number }) {
  const [isAnswerVisible, setIsAnswerVisible] = useState(false)
  const card = cardRow.data

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex flex-col gap-3">
      <div className="flex gap-3">
        <span className="text-xs text-zinc-600 pt-0.5 shrink-0">{index}.</span>
        <div className="flex flex-col gap-2 flex-1">
          <QuestionDisplay card={card} />
        </div>
      </div>

      {!isAnswerVisible ? (
        <button
          onClick={() => setIsAnswerVisible(true)}
          className="self-start text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors"
        >
          Show answer
        </button>
      ) : (
        <div className="flex flex-col gap-1 pt-1 border-t border-zinc-800">
          <AnswerDisplay card={card} />
          {card.explanation && (
            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{card.explanation}</p>
          )}
        </div>
      )}
    </div>
  )
}

function QuestionDisplay({ card }: { card: CardRow['data'] }) {
  if (card.type === 'multiple-choice') {
    const mc = card as MultipleChoiceCard
    return (
      <>
        <p className="text-sm text-zinc-200">{mc.question}</p>
        <ul className="flex flex-col gap-1">
          {mc.options.map((option, index) => (
            <li key={index} className="text-xs text-zinc-400 pl-3">
              {String.fromCharCode(65 + index)}. {option}
            </li>
          ))}
        </ul>
      </>
    )
  }

  if (card.type === 'fill-in-blank') {
    return <p className="text-sm text-zinc-200">{(card as FillInBlankCard).prompt}</p>
  }

  return <p className="text-sm text-zinc-200">{(card as FreeTextCard).question}</p>
}

function AnswerDisplay({ card }: { card: CardRow['data'] }) {
  if (card.type === 'multiple-choice') {
    const mc = card as MultipleChoiceCard
    return (
      <p className="text-sm text-emerald-400">
        {String.fromCharCode(65 + mc.correctIndex)}. {mc.options[mc.correctIndex]}
      </p>
    )
  }

  if (card.type === 'fill-in-blank') {
    const fib = card as FillInBlankCard
    return (
      <p className="text-sm text-emerald-400">
        {fib.acceptedAnswers.join(' / ')}
      </p>
    )
  }

  return <p className="text-xs text-zinc-500 italic">Self-rated — any thoughtful answer counts.</p>
}
