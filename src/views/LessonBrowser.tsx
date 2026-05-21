// LessonBrowser.tsx — browse and filter all locally cached lessons by tag and source.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAllLessons, getAllTags } from '@/services/lessonService'
import { getAllSources } from '@/services/sourceManager'
import { useErrorStore } from '@/stores/uiStore'
import type { LessonRow, SourceRow } from '@/lib/types'

export function LessonBrowser() {
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [sources, setSources] = useState<SourceRow[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [selectedSourceId, setSelectedSourceId] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const showError = useErrorStore(s => s.show)

  useEffect(() => {
    async function load() {
      try {
        const [loadedLessons, loadedSources, loadedTags] = await Promise.all([
          getAllLessons(),
          getAllSources(),
          getAllTags(),
        ])
        setLessons(loadedLessons)
        setSources(loadedSources)
        setAllTags(loadedTags)
      } catch (e) {
        showError(String(e))
      }
    }
    void load()
  }, [showError])

  const filteredLessons = lessons.filter(lesson => {
    if (selectedSourceId !== 'all' && lesson.sourceId !== selectedSourceId) return false
    if (selectedTag !== 'all' && !lesson.tags.includes(selectedTag)) return false
    return true
  })

  return (
    <div className="px-4 py-8 max-w-lg mx-auto flex flex-col gap-6">
      <h1 className="text-xl text-zinc-100 font-medium tracking-tight">Lessons</h1>

      <div className="flex gap-3 flex-wrap">
        <FilterSelect
          label="Source"
          value={selectedSourceId}
          onChange={setSelectedSourceId}
          options={[
            { value: 'all', label: 'All sources' },
            ...sources.map(s => ({ value: s.sourceId, label: s.label })),
          ]}
        />
        <FilterSelect
          label="Tag"
          value={selectedTag}
          onChange={setSelectedTag}
          options={[
            { value: 'all', label: 'All tags' },
            ...allTags.map(t => ({ value: t, label: t })),
          ]}
        />
      </div>

      {filteredLessons.length === 0 ? (
        <p className="text-zinc-500 text-sm">
          {lessons.length === 0 ? 'No lessons synced yet. Go to Sources to sync.' : 'No lessons match the current filters.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filteredLessons.map(lesson => (
            <LessonCard key={`${lesson.sourceId}|${lesson.lessonId}`} lesson={lesson} />
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function LessonCard({ lesson }: { lesson: LessonRow }) {
  return (
    <li>
      <Link
        to={`/lessons/${encodeURIComponent(lesson.sourceId)}/${encodeURIComponent(lesson.lessonId)}`}
        className="block rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3 hover:border-zinc-600 transition-colors"
      >
        <div className="text-sm text-zinc-200">{lesson.title}</div>
        {lesson.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {lesson.tags.map(tag => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </Link>
    </li>
  )
}

interface FilterSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}

function FilterSelect({ label, value, onChange, options }: FilterSelectProps) {
  const id = `filter-${label.toLowerCase()}`
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs text-zinc-500 shrink-0">{label}</label>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
