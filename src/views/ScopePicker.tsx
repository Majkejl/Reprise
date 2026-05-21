// ScopePicker.tsx — select which sources, categories, and tags are in scope for study sessions.

import { useEffect, useState } from 'react'
import { getAllTags, getAllCategories } from '@/services/lessonService'
import { getAllSources } from '@/services/sourceManager'
import { useUIStore, useErrorStore } from '@/stores/uiStore'
import type { SourceRow } from '@/lib/types'

export function ScopePicker() {
  const [availableSources, setAvailableSources] = useState<SourceRow[]>([])
  const [availableCategories, setAvailableCategories] = useState<string[]>([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const scope = useUIStore(s => s.scope)
  const setScope = useUIStore(s => s.setScope)
  const showError = useErrorStore(s => s.show)

  useEffect(() => {
    async function load() {
      try {
        const [sources, categories, tags] = await Promise.all([
          getAllSources(),
          getAllCategories(),
          getAllTags(),
        ])
        setAvailableSources(sources)
        setAvailableCategories(categories)
        setAvailableTags(tags)
      } catch (e) {
        showError(String(e))
      }
    }
    void load()
  }, [showError])

  const isAllSources = scope.sourceIds === 'all'
  const isAllCategories = (scope.categories ?? 'all') === 'all'
  const isAllTags = scope.tags === 'all'

  // Tags section is expanded by default only if specific tags are already selected,
  // so users with a clean scope see a compact view.
  const [isTagsExpanded, setIsTagsExpanded] = useState(!isAllTags)

  const selectedSourceIds = isAllSources ? [] : (scope.sourceIds as string[])
  const selectedCategories = isAllCategories ? [] : (scope.categories as string[])
  const selectedTags = isAllTags ? [] : (scope.tags as string[])

  const { flatTags, tagGroups } = buildTagGroups(availableTags)

  const handleSourcesAllToggle = async () => {
    try { await setScope({ ...scope, sourceIds: 'all' }) } catch (e) { showError(String(e)) }
  }

  const handleSourceToggle = async (sourceId: string) => {
    const current = isAllSources ? [] : (scope.sourceIds as string[])
    const next = current.includes(sourceId)
      ? current.filter(id => id !== sourceId)
      : [...current, sourceId]
    try { await setScope({ ...scope, sourceIds: next.length > 0 ? next : 'all' }) } catch (e) { showError(String(e)) }
  }

  const handleCategoriesAllToggle = async () => {
    try { await setScope({ ...scope, categories: 'all' }) } catch (e) { showError(String(e)) }
  }

  const handleCategoryToggle = async (category: string) => {
    const current = isAllCategories ? [] : (scope.categories as string[])
    const next = current.includes(category)
      ? current.filter(c => c !== category)
      : [...current, category]
    try { await setScope({ ...scope, categories: next.length > 0 ? next : 'all' }) } catch (e) { showError(String(e)) }
  }

  const handleTagsAllToggle = async () => {
    try { await setScope({ ...scope, tags: 'all' }) } catch (e) { showError(String(e)) }
  }

  const handleTagToggle = async (tag: string) => {
    const current = isAllTags ? [] : (scope.tags as string[])
    const next = current.includes(tag)
      ? current.filter(t => t !== tag)
      : [...current, tag]
    try { await setScope({ ...scope, tags: next.length > 0 ? next : 'all' }) } catch (e) { showError(String(e)) }
  }

  const handleGroupToggle = async (groupTags: string[]) => {
    const current = isAllTags ? [] : (scope.tags as string[])
    const allInGroup = groupTags.every(t => current.includes(t))
    const next = allInGroup
      ? current.filter(t => !groupTags.includes(t))
      : [...new Set([...current, ...groupTags])]
    try { await setScope({ ...scope, tags: next.length > 0 ? next : 'all' }) } catch (e) { showError(String(e)) }
  }

  return (
    <div className="px-4 py-8 max-w-lg mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-xl text-zinc-100 font-medium tracking-tight">Scope</h1>
        <p className="text-xs text-zinc-500 mt-1">
          Choose what is included in your study sessions. Changes take effect at the next session start.
        </p>
      </div>

      {/* ── Sources ── */}
      <section aria-labelledby="scope-sources-heading" className="flex flex-col gap-3">
        <h2 id="scope-sources-heading" className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Sources</h2>
        <CheckRow label="All sources" isChecked={isAllSources} onToggle={handleSourcesAllToggle} />
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

      {/* ── Categories ── */}
      {availableCategories.length > 0 && (
        <section aria-labelledby="scope-categories-heading" className="flex flex-col gap-3">
          <h2 id="scope-categories-heading" className="text-xs text-zinc-400 font-medium uppercase tracking-wide">Categories</h2>
          <CheckRow label="All categories" isChecked={isAllCategories} onToggle={handleCategoriesAllToggle} />
          {availableCategories.map(category => (
            <CheckRow
              key={category}
              label={category}
              isChecked={!isAllCategories && selectedCategories.includes(category)}
              onToggle={() => handleCategoryToggle(category)}
            />
          ))}
        </section>
      )}

      {/* ── Tags (collapsible) ── */}
      <section aria-labelledby="scope-tags-heading" className="flex flex-col gap-3">
        <button
          id="scope-tags-heading"
          onClick={() => setIsTagsExpanded(v => !v)}
          className="flex items-center justify-between text-xs text-zinc-400 font-medium uppercase tracking-wide w-full text-left"
          aria-expanded={isTagsExpanded}
        >
          <span>
            Tags
            {!isAllTags && (
              <span className="ml-2 text-sky-400 normal-case font-normal">
                {selectedTags.length} selected
              </span>
            )}
          </span>
          <span className={`transition-transform ${isTagsExpanded ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {isTagsExpanded && (
          <div className="flex flex-col gap-3">
            <CheckRow label="All tags" isChecked={isAllTags} onToggle={handleTagsAllToggle} />

            {flatTags.map(tag => (
              <CheckRow
                key={tag}
                label={tag}
                isChecked={isAllTags || selectedTags.includes(tag)}
                onToggle={() => handleTagToggle(tag)}
              />
            ))}

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
          </div>
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
