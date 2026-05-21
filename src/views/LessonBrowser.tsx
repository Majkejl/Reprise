// LessonBrowser.tsx — browse and filter all locally cached lessons by category, tag, and source.

import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAllLessons, getAllTags, deleteLesson, getLessonProgressMap } from '@/services/lessonService'
import { startSessionForLesson } from '@/services/sessionService'
import { getAllSources } from '@/services/sourceManager'
import { useErrorStore } from '@/stores/uiStore'
import { useSessionStore } from '@/stores/sessionStore'
import type { LessonRow, SourceRow } from '@/lib/types'

// Category → accent color mapping (mirrors design tokens for left border)
const CAT_COLORS: Record<string, string> = {
  algorithms:        'var(--c-accent)',
  'data-structures': 'var(--c-green)',
  complexity:        'var(--c-purple)',
  trees:             'var(--c-amber)',
  graphs:            'var(--c-purple)',
  dp:                'var(--c-amber)',
  heaps:             'var(--c-green)',
  IB031:             'var(--c-accent)',
}

export function LessonBrowser() {
  const navigate = useNavigate()
  const [lessons, setLessons] = useState<LessonRow[]>([])
  const [sources, setSources] = useState<SourceRow[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [progressMap, setProgressMap] = useState<Record<string, number>>({})
  const [selectedSourceId, setSelectedSourceId] = useState<string>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const showError = useErrorStore(s => s.show)
  const sessionStart = useSessionStore(s => s.startSession)

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
        setProgressMap(await getLessonProgressMap(loadedLessons))
      } catch (e) {
        showError(String(e))
      }
    }
    void load()
  }, [showError])

  async function handleStudyLesson(sourceId: string, lessonId: string) {
    try {
      const queue = await startSessionForLesson(sourceId, lessonId)
      sessionStart(queue)
      navigate('/study')
    } catch (e) {
      showError(String(e))
    }
  }

  async function handleDeleteLesson(sourceId: string, lessonId: string) {
    if (!window.confirm('Delete this lesson and its card progress? This cannot be undone.')) return
    try {
      await deleteLesson(sourceId, lessonId)
      setLessons(prev => prev.filter(l => !(l.sourceId === sourceId && l.lessonId === lessonId)))
    } catch (e) {
      showError(String(e))
    }
  }

  const availableCategories = Array.from(
    new Set(lessons.map(l => l.category).filter((c): c is string => !!c)),
  ).sort()

  const { flatTags, tagGroups } = buildTagGroups(allTags)

  const filteredLessons = lessons.filter(lesson => {
    if (selectedSourceId !== 'all' && lesson.sourceId !== selectedSourceId) return false
    if (selectedCategory !== 'all' && lesson.category !== selectedCategory) return false
    if (selectedTag !== 'all') {
      const matchesTag = lesson.tags.some(t => t === selectedTag || t.startsWith(selectedTag + '/'))
      if (!matchesTag) return false
    }
    return true
  })

  const sourceOptions = [
    { value: 'all', label: 'all sources' },
    ...sources.map(s => ({ value: s.sourceId, label: s.label })),
  ]
  const categoryOptions = [
    { value: 'all', label: 'all' },
    ...availableCategories.map(c => ({ value: c, label: c })),
  ]

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 512, margin: '0 auto' }}>
      <h1 style={{ fontSize: 16, color: 'var(--c-text)', fontWeight: 500 }}>Lessons</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Source chips */}
        <ChipFilterGroup
          options={sourceOptions}
          selected={selectedSourceId}
          onSelect={setSelectedSourceId}
        />
        {/* Category chips */}
        {availableCategories.length > 0 && (
          <ChipFilterGroup
            options={categoryOptions}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />
        )}
        {/* Tag select (can be many) */}
        {allTags.length > 0 && (
          <TagFilterSelect
            value={selectedTag}
            onChange={setSelectedTag}
            flatTags={flatTags}
            tagGroups={tagGroups}
          />
        )}
      </div>

      {filteredLessons.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--c-text3)' }}>
          {lessons.length === 0 ? 'No lessons synced yet. Go to Sources to sync.' : 'No lessons match the current filters.'}
        </p>
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 5, listStyle: 'none', margin: 0, padding: 0 }}>
          {filteredLessons.map(lesson => (
            <LessonCard
              key={`${lesson.sourceId}|${lesson.lessonId}`}
              lesson={lesson}
              progress={progressMap[`${lesson.sourceId}|${lesson.lessonId}`] ?? 0}
              onStudy={handleStudyLesson}
              onDelete={handleDeleteLesson}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface TagGroup {
  prefix: string
  tags: string[]
}

function buildTagGroups(tags: string[]): { flatTags: string[]; tagGroups: TagGroup[] } {
  const flatTags: string[] = []
  const groupMap = new Map<string, string[]>()
  for (const tag of tags) {
    const slashIndex = tag.indexOf('/')
    if (slashIndex < 0) {
      flatTags.push(tag)
    } else {
      const prefix = tag.slice(0, slashIndex)
      const list = groupMap.get(prefix) ?? []
      list.push(tag)
      groupMap.set(prefix, list)
    }
  }
  return {
    flatTags,
    tagGroups: Array.from(groupMap.entries()).map(([prefix, groupTags]) => ({ prefix, tags: groupTags })),
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function ChipFilterGroup({
  options,
  selected,
  onSelect,
}: {
  options: Array<{ value: string; label: string }>
  selected: string
  onSelect: (value: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {options.map(opt => {
        const isActive = opt.value === selected
        return (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            style={{
              padding: '4px 10px', borderRadius: 4, fontFamily: 'inherit', fontSize: 10,
              border: `1px solid ${isActive ? 'var(--c-accent)' : 'var(--c-border)'}`,
              background: isActive ? 'color-mix(in srgb, var(--c-accent) 10%, transparent)' : 'var(--c-raised)',
              color: isActive ? 'var(--c-accent)' : 'var(--c-text2)',
              cursor: 'pointer', transition: 'all 120ms',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

interface LessonCardProps {
  lesson: LessonRow
  progress: number
  onStudy: (sourceId: string, lessonId: string) => void
  onDelete: (sourceId: string, lessonId: string) => void
}

function LessonCard({ lesson, progress, onStudy, onDelete }: LessonCardProps) {
  const accentColor = CAT_COLORS[lesson.category ?? ''] ?? CAT_COLORS[lesson.tags[0]] ?? 'var(--c-text3)'
  const progressColor = progress >= 90 ? 'var(--c-green)' : 'var(--c-accent)'
  return (
    <li style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderLeft: `3px solid ${accentColor}`, borderRadius: 7, display: 'flex', alignItems: 'stretch' }}>
      <Link
        to={`/lessons/${encodeURIComponent(lesson.sourceId)}/${encodeURIComponent(lesson.lessonId)}`}
        style={{ flex: 1, padding: '10px 12px 0', textDecoration: 'none', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--c-text)', lineHeight: 1.4 }}>{lesson.title}</div>
          <span style={{ fontSize: 9, color: progress > 0 ? progressColor : 'var(--c-text3)', whiteSpace: 'nowrap', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{progress}%</span>
        </div>
        {lesson.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
            {lesson.tags.map(tag => (
              <span key={tag} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--c-raised)', border: '1px solid var(--c-border)', color: 'var(--c-text3)', letterSpacing: '0.02em' }}>
                #{tag.replace(/\//g, ' › ')}
              </span>
            ))}
          </div>
        )}
        <div style={{ height: 2, background: 'var(--c-raised)', marginTop: 10, borderRadius: 1 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: progressColor, borderRadius: 1, transition: 'width 400ms ease' }} />
        </div>
      </Link>
      <button
        onClick={() => onStudy(lesson.sourceId, lesson.lessonId)}
        aria-label={`Study ${lesson.title}`}
        title="Study this lesson"
        style={{ padding: '0 12px', background: 'none', border: 'none', borderLeft: '1px solid var(--c-border)', color: 'var(--c-text3)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
      >
        ▶
      </button>
      <button
        onClick={() => onDelete(lesson.sourceId, lesson.lessonId)}
        aria-label={`Delete ${lesson.title}`}
        style={{ padding: '0 10px', background: 'none', border: 'none', borderLeft: '1px solid var(--c-border)', color: 'var(--c-text3)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}
      >
        ✕
      </button>
    </li>
  )
}

interface TagFilterSelectProps {
  value: string
  onChange: (value: string) => void
  flatTags: string[]
  tagGroups: TagGroup[]
}

function TagFilterSelect({ value, onChange, flatTags, tagGroups }: TagFilterSelectProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>tag</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ padding: '4px 8px', borderRadius: 4, fontFamily: 'inherit', fontSize: 10, border: '1px solid var(--c-border)', background: 'var(--c-raised)', color: 'var(--c-text2)', cursor: 'pointer', outline: 'none' }}
      >
        <option value="all">all tags</option>
        {flatTags.map(tag => (
          <option key={tag} value={tag}>{tag}</option>
        ))}
        {tagGroups.map(group => (
          <optgroup key={group.prefix} label={group.prefix}>
            <option value={group.prefix}>all {group.prefix}</option>
            {group.tags.map(tag => (
              <option key={tag} value={tag}>{tag.slice(group.prefix.length + 1)}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  )
}
