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

  const { flatTags, tagGroups } = buildTagGroups(availableTags)

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

  const handleGroupToggle = async (groupTags: string[]) => {
    // Consistent with single-tag toggle: clicking a group when "all" is selected scopes to that group.
    const current = isAllTags ? [] : (scope.tags as string[])
    const allInGroup = groupTags.every(t => current.includes(t))
    const next = allInGroup
      ? current.filter(t => !groupTags.includes(t))
      : [...new Set([...current, ...groupTags])]
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

      <section aria-labelledby="scope-sources-heading" className="flex flex-col gap-3">
        <h2 id="scope-sources-heading" className="text-xs text-zinc-400 font-medium">Sources</h2>
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

      <section aria-labelledby="scope-tags-heading" className="flex flex-col gap-3">
        <h2 id="scope-tags-heading" className="text-xs text-zinc-400 font-medium">Tags</h2>
        <CheckRow
          label="All tags"
          isChecked={isAllTags}
          onToggle={handleTagsAllToggle}
        />

        {/* Flat (ungrouped) tags */}
        {flatTags.map(tag => (
          <CheckRow
            key={tag}
            label={tag}
            isChecked={isAllTags || selectedTags.includes(tag)}
            onToggle={() => handleTagToggle(tag)}
          />
        ))}

        {/* Hierarchical tag groups */}
        {tagGroups.map(group => {
          const allInGroup = isAllTags || group.tags.every(t => selectedTags.includes(t))
          const someInGroup = !isAllTags && group.tags.some(t => selectedTags.includes(t))
          return (
            <div key={group.prefix} className="flex flex-col gap-2">
              <GroupRow
                label={group.prefix}
                isAllChecked={allInGroup}
                isSomeChecked={someInGroup}
                onToggle={() => handleGroupToggle(group.tags)}
              />
              {group.tags.map(tag => (
                <div key={tag} className="pl-7">
                  <CheckRow
                    label={tag.slice(group.prefix.length + 1)}
                    isChecked={isAllTags || selectedTags.includes(tag)}
                    onToggle={() => handleTagToggle(tag)}
                  />
                </div>
              ))}
            </div>
          )
        })}

        {availableTags.length === 0 && (
          <p className="text-xs text-zinc-600">No tags found in synced lessons.</p>
        )}
      </section>
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
      aria-pressed={isChecked}
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

interface GroupRowProps {
  label: string
  isAllChecked: boolean
  isSomeChecked: boolean
  onToggle: () => void
}

function GroupRow({ label, isAllChecked, isSomeChecked, onToggle }: GroupRowProps) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={isAllChecked}
      className="flex items-center gap-3 text-sm text-left font-medium"
    >
      <span
        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
          isAllChecked
            ? 'border-sky-600 bg-sky-900/60 text-sky-400'
            : isSomeChecked
              ? 'border-sky-700/60 bg-sky-900/20 text-sky-600'
              : 'border-zinc-700 text-transparent'
        }`}
      >
        {isAllChecked ? '✓' : isSomeChecked ? '–' : '✓'}
      </span>
      <span className={isAllChecked || isSomeChecked ? 'text-zinc-200' : 'text-zinc-400'}>
        {label}
      </span>
    </button>
  )
}
