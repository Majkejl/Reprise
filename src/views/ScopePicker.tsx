// ScopePicker.tsx — select which sources and tags are in scope for study sessions.

import { useEffect, useState } from 'react'
import { getAllTags } from '@/services/lessonService'
import { getAllSources } from '@/services/sourceManager'
import { useUIStore, useErrorStore } from '@/stores/uiStore'
import type { SourceRow, Scope } from '@/lib/types'

export function ScopePicker() {
  const [availableSources, setAvailableSources] = useState<SourceRow[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const scope = useUIStore(s => s.scope)
  const setScope = useUIStore(s => s.setScope)
  const showError = useErrorStore(s => s.show)

  useEffect(() => {
    async function load() {
      try {
        const [sources, tags] = await Promise.all([getAllSources(), getAllTags()])
        setAvailableSources(sources)
        setAvailableTags(tags)
      } catch (e) {
        showError(String(e))
      }
    }
    void load()
  }, [showError])

  const isAllSources = scope.sourceIds === 'all'
  const isAllTags = scope.tags === 'all'

  const selectedSourceIds = isAllSources ? [] : (scope.sourceIds as string[])
  const selectedTags = isAllTags ? [] : (scope.tags as string[])

  const handleSourcesAllToggle = async () => {
    const updatedScope: Scope = { ...scope, sourceIds: 'all' }
    try { await setScope(updatedScope) } catch (e) { showError(String(e)) }
  }

  const handleTagsAllToggle = async () => {
    const updatedScope: Scope = { ...scope, tags: 'all' }
    try { await setScope(updatedScope) } catch (e) { showError(String(e)) }
  }

  const handleSourceToggle = async (sourceId: string) => {
    const current = isAllSources ? [] : (scope.sourceIds as string[])
    const next = current.includes(sourceId)
      ? current.filter(id => id !== sourceId)
      : [...current, sourceId]
    const updatedScope: Scope = { ...scope, sourceIds: next.length > 0 ? next : 'all' }
    try { await setScope(updatedScope) } catch (e) { showError(String(e)) }
  }

  const handleTagToggle = async (tag: string) => {
    const current = isAllTags ? [] : (scope.tags as string[])
    const next = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag]
    const updatedScope: Scope = { ...scope, tags: next.length > 0 ? next : 'all' }
    try { await setScope(updatedScope) } catch (e) { showError(String(e)) }
  }

  return (
    <div className="px-4 py-8 max-w-lg mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-xl text-zinc-100 font-medium tracking-tight">Scope</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Choose which sources and tags are included in your study sessions. Changes take effect at the next session start.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <p className="text-xs text-zinc-400 font-medium">Sources</p>
        <CheckRow
          label="All sources"
          isChecked={isAllSources}
          onToggle={handleSourcesAllToggle}
        />
        {availableSources.map(source => (
          <CheckRow
            key={source.sourceId}
            label={source.label}
            isChecked={!isAllSources && selectedSourceIds.includes(source.sourceId)}
            onToggle={() => handleSourceToggle(source.sourceId)}
          />
        ))}
        {availableSources.length === 0 && (
          <p className="text-xs text-zinc-600">No sources registered yet.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <p className="text-xs text-zinc-400 font-medium">Tags</p>
        <CheckRow
          label="All tags"
          isChecked={isAllTags}
          onToggle={handleTagsAllToggle}
        />
        {availableTags.map(tag => (
          <CheckRow
            key={tag}
            label={tag}
            isChecked={!isAllTags && selectedTags.includes(tag)}
            onToggle={() => handleTagToggle(tag)}
          />
        ))}
        {availableTags.length === 0 && (
          <p className="text-xs text-zinc-600">No tags found in synced lessons.</p>
        )}
      </section>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface CheckRowProps {
  label: string
  isChecked: boolean
  isDisabled?: boolean
  onToggle: () => void
}

function CheckRow({ label, isChecked, isDisabled = false, onToggle }: CheckRowProps) {
  return (
    <button
      onClick={onToggle}
      disabled={isDisabled}
      className="flex items-center gap-3 text-sm text-left disabled:opacity-40"
    >
      <span
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
          isChecked
            ? 'border-sky-600 bg-sky-900/60 text-sky-400'
            : 'border-zinc-700 text-transparent'
        }`}
      >
        ✓
      </span>
      <span className={isChecked ? 'text-zinc-200' : 'text-zinc-400'}>{label}</span>
    </button>
  )
}
