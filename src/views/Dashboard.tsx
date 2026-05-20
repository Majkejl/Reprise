import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CardsRepo, SourcesRepo } from '@/db'
import { getDueCards } from '@/services/fsrsService'
import { useErrorStore } from '@/stores/uiStore'

export function Dashboard() {
  const navigate = useNavigate()
  const showError = useErrorStore(s => s.show)
  const [dueCount, setDueCount] = useState<number | null>(null)
  const [sourceCount, setSourceCount] = useState<number | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [allCards, sources] = await Promise.all([
          CardsRepo.getDueBefore(Date.now()),
          SourcesRepo.getAll(),
        ])
        setDueCount(getDueCards(allCards).length)
        setSourceCount(sources.length)
      } catch (e) {
        showError(String(e))
      }
    }
    void load()
  }, [showError])

  return (
    <div className="flex flex-col gap-8 px-4 py-8 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl text-zinc-100 font-medium tracking-tight">Reprise</h1>
        <p className="text-zinc-500 text-sm mt-1">Spaced-repetition exam revision</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Due now" value={dueCount} />
        <Stat label="Sources" value={sourceCount} />
      </div>

      <button
        onClick={() => navigate('/study')}
        className="rounded border border-sky-700 bg-sky-950/40 px-6 py-3 text-sky-300 text-sm hover:bg-sky-900/40 transition-colors"
      >
        Start study session →
      </button>

      <div className="rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-xs text-zinc-600">
        Source health — coming in Phase 3
      </div>
    </div>
  )
}

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
