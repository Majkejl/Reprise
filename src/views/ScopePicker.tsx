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
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 512, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 16, color: 'var(--c-text)', fontWeight: 500 }}>Scope</h1>
        <p style={{ fontSize: 11, color: 'var(--c-text2)', marginTop: 3, lineHeight: 1.5 }}>
          Define what appears in study sessions.
        </p>
      </div>

      {/* ── Sources ── */}
      <section aria-labelledby="scope-sources-heading">
        <h2 id="scope-sources-heading" style={{ fontSize: 10, color: 'var(--c-text3)', letterSpacing: '0.07em', marginBottom: 6, fontStyle: 'italic', fontWeight: 400 }}>
          // SOURCES
        </h2>
        <CheckRow label="All sources" isChecked={isAllSources} onToggle={handleSourcesAllToggle} />
        {availableSources.map(source => (
          <CheckRow
            key={source.sourceId}
            label={source.label}
            isChecked={!isAllSources && selectedSourceIds.includes(source.sourceId)}
            onToggle={() => handleSourceToggle(source.sourceId)}
            indent
          />
        ))}
        {availableSources.length === 0 && (
          <p style={{ fontSize: 11, color: 'var(--c-text3)' }}>No sources registered yet.</p>
        )}
      </section>

      {/* ── Categories ── */}
      {availableCategories.length > 0 && (
        <section aria-labelledby="scope-categories-heading" style={{ marginTop: 14 }}>
          <h2 id="scope-categories-heading" style={{ fontSize: 10, color: 'var(--c-text3)', letterSpacing: '0.07em', marginBottom: 6, fontStyle: 'italic', fontWeight: 400 }}>
            // CATEGORIES
          </h2>
          <CheckRow label="All categories" isChecked={isAllCategories} onToggle={handleCategoriesAllToggle} />
          {availableCategories.map(category => (
            <CheckRow
              key={category}
              label={category}
              isChecked={!isAllCategories && selectedCategories.includes(category)}
              onToggle={() => handleCategoryToggle(category)}
              indent
            />
          ))}
        </section>
      )}

      {/* ── Tags (collapsible) ── */}
      <section aria-labelledby="scope-tags-heading" style={{ marginTop: 14 }}>
        <button
          id="scope-tags-heading"
          aria-label="Tags"
          onClick={() => setIsTagsExpanded(v => !v)}
          aria-expanded={isTagsExpanded}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}
        >
          <span style={{ fontSize: 10, color: 'var(--c-text3)', letterSpacing: '0.07em', fontStyle: 'italic' }}>
            {'// TAGS'}
            {!isAllTags && (
              <span style={{ marginLeft: 8, color: 'var(--c-accent)', fontStyle: 'normal', letterSpacing: 0 }}>
                {selectedTags.length} selected
              </span>
            )}
          </span>
          <span style={{ fontSize: 10, color: 'var(--c-text3)', transform: isTagsExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }}>▾</span>
        </button>

        {isTagsExpanded && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                <div key={group.prefix}>
                  <GroupRow
                    label={group.prefix}
                    isAllChecked={allInGroup}
                    isSomeChecked={someInGroup}
                    onToggle={() => handleGroupToggle(group.tags)}
                  />
                  {group.tags.map(tag => (
                    <CheckRow
                      key={tag}
                      label={tag.slice(group.prefix.length + 1)}
                      isChecked={isAllTags || selectedTags.includes(tag)}
                      onToggle={() => handleTagToggle(tag)}
                      indent
                    />
                  ))}
                </div>
              )
            })}

            {availableTags.length === 0 && (
              <p style={{ fontSize: 11, color: 'var(--c-text3)' }}>No tags found in synced lessons.</p>
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
  indent?: boolean
}

function CheckRow({ label, isChecked, isDisabled = false, onToggle, indent = false }: CheckRowProps) {
  return (
    <button
      onClick={onToggle}
      disabled={isDisabled}
      aria-pressed={isChecked}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none',
        cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left',
        paddingLeft: indent ? 22 : 0, paddingTop: 5, paddingBottom: 5, opacity: isDisabled ? 0.4 : 1,
      }}
    >
      <span style={{
        width: 15, height: 15, borderRadius: 3, flexShrink: 0,
        border: `1px solid ${isChecked ? 'var(--c-accent)' : 'var(--c-border)'}`,
        background: isChecked ? 'color-mix(in srgb, var(--c-accent) 10%, transparent)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, color: isChecked ? 'var(--c-accent)' : 'transparent', lineHeight: 1, transition: 'all 120ms',
      }}>✓</span>
      <span style={{ fontSize: 12, color: isChecked ? 'var(--c-text)' : 'var(--c-text2)', transition: 'color 120ms' }}>
        {label}
      </span>
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
  const isAny = isAllChecked || isSomeChecked
  return (
    <button
      onClick={onToggle}
      aria-pressed={isAllChecked}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none',
        cursor: 'pointer', fontFamily: 'inherit', width: '100%', textAlign: 'left',
        paddingTop: 5, paddingBottom: 5,
      }}
    >
      <span style={{
        width: 15, height: 15, borderRadius: 3, flexShrink: 0,
        border: `1px solid ${isAny ? 'color-mix(in srgb, var(--c-accent) 60%, transparent)' : 'var(--c-border)'}`,
        background: isAny ? 'color-mix(in srgb, var(--c-accent) 10%, transparent)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 9, color: isAny ? 'var(--c-accent)' : 'transparent', lineHeight: 1, transition: 'all 120ms',
      }}>
        {isAllChecked ? '✓' : isSomeChecked ? '–' : '✓'}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: isAny ? 'var(--c-text)' : 'var(--c-text2)', transition: 'color 120ms' }}>
        {label}
      </span>
    </button>
  )
}
