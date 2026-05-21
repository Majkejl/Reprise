// Sources.tsx — register, remove, manually sync lesson sources, and configure per-source category filters.

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  getAllSources,
  syncSource,
  syncAll,
  registerSource,
  removeSource,
  getSourceCategoryFilter,
  setSourceCategoryFilter,
  OFFICIAL_SOURCE_ID,
  type SyncProgressCallback,
} from '@/services/sourceManager'
import { getCategoriesForSource } from '@/services/lessonService'
import { useUIStore, useErrorStore } from '@/stores/uiStore'
import type { SourceRow, SyncStatus } from '@/lib/types'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', background: 'var(--c-raised)',
  border: '1px solid var(--c-border)', borderRadius: 5,
  color: 'var(--c-text)', fontFamily: 'inherit', fontSize: 11, outline: 'none',
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: '4px 10px', background: 'none', border: '1px solid var(--c-border)',
  borderRadius: 4, color: 'var(--c-text2)', fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
}

export function Sources() {
  const [sources, setSources] = useState<SourceRow[]>([])
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [newSourceLabel, setNewSourceLabel] = useState('')
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [categoriesMap, setCategoriesMap] = useState<Record<string, string[]>>({})
  const [categoryFiltersMap, setCategoryFiltersMap] = useState<Record<string, string[] | 'all'>>({})

  const syncStatus = useUIStore(s => s.syncStatus)
  const setSyncStatus = useUIStore(s => s.setSyncStatus)
  const showError = useErrorStore(s => s.show)

  const loadSources = useCallback(async () => {
    try {
      const loadedSources = await getAllSources()
      setSources(loadedSources)
      const [cats, filters] = await Promise.all([
        Promise.all(loadedSources.map(s => getCategoriesForSource(s.sourceId))),
        Promise.all(loadedSources.map(s => getSourceCategoryFilter(s.sourceId))),
      ])
      const newCatsMap: Record<string, string[]> = {}
      const newFiltersMap: Record<string, string[] | 'all'> = {}
      loadedSources.forEach((s, i) => {
        newCatsMap[s.sourceId] = cats[i]
        newFiltersMap[s.sourceId] = filters[i]
      })
      setCategoriesMap(newCatsMap)
      setCategoryFiltersMap(newFiltersMap)
    } catch (e) {
      showError(String(e))
    }
  }, [showError])

  useEffect(() => {
    void loadSources()
  }, [loadSources])

  const handleSyncSource = async (sourceId: string) => {
    const onProgress: SyncProgressCallback = (id, status) => setSyncStatus(id, status)
    try {
      await syncSource(sourceId, onProgress)
      await loadSources()
    } catch (e) {
      showError(String(e))
    }
  }

  const handleSyncAll = async () => {
    setIsSyncingAll(true)
    const onProgress: SyncProgressCallback = (id, status) => setSyncStatus(id, status)
    try {
      await syncAll(onProgress)
      await loadSources()
    } catch (e) {
      showError(String(e))
    } finally {
      setIsSyncingAll(false)
    }
  }

  const handleAddSource = async (e: FormEvent) => {
    e.preventDefault()
    if (!newSourceUrl.trim()) return
    try {
      await registerSource(newSourceUrl.trim(), newSourceLabel.trim())
      setNewSourceUrl('')
      setNewSourceLabel('')
      await loadSources()
    } catch (e) {
      showError(String(e))
    }
  }

  const handleRemoveSource = async (sourceId: string) => {
    try {
      await removeSource(sourceId)
      await loadSources()
    } catch (e) {
      showError(String(e))
    }
  }

  const handleToggleCategory = async (sourceId: string, category: string) => {
    const current = categoryFiltersMap[sourceId] ?? 'all'
    const available = categoriesMap[sourceId] ?? []
    let next: string[] | 'all'
    if (current === 'all') {
      const withoutThis = available.filter(c => c !== category)
      next = withoutThis.length === 0 ? 'all' : withoutThis
    } else {
      const cats = current as string[]
      const updated = cats.includes(category) ? cats.filter(c => c !== category) : [...cats, category]
      next = updated.length === 0 ? 'all' : updated
    }
    try {
      await setSourceCategoryFilter(sourceId, next)
      setCategoryFiltersMap(prev => ({ ...prev, [sourceId]: next }))
    } catch (e) {
      showError(String(e))
    }
  }

  const handleSetAllCategories = async (sourceId: string) => {
    try {
      await setSourceCategoryFilter(sourceId, 'all')
      setCategoryFiltersMap(prev => ({ ...prev, [sourceId]: 'all' }))
    } catch (e) {
      showError(String(e))
    }
  }

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 512, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 16, color: 'var(--c-text)', fontWeight: 500 }}>Sources</h1>
        <button
          onClick={handleSyncAll}
          disabled={isSyncingAll || sources.length === 0}
          style={{ ...secondaryButtonStyle, opacity: (isSyncingAll || sources.length === 0) ? 0.4 : 1 }}
        >
          {isSyncingAll ? 'Syncing…' : 'Sync all'}
        </button>
      </div>

      <p style={{ fontSize: 10, color: 'var(--c-text3)', marginTop: -6, lineHeight: 1.6 }}>
        Sync is append-only — removing a lesson from a source does not remove it from your device.
      </p>

      <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', margin: 0, padding: 0 }}>
        {sources.length === 0 && (
          <li style={{ fontSize: 12, color: 'var(--c-text3)' }}>No sources registered.</li>
        )}
        {sources.map(source => (
          <SourceListItem
            key={source.sourceId}
            source={source}
            status={syncStatus[source.sourceId] ?? 'idle'}
            isOfficial={source.sourceId === OFFICIAL_SOURCE_ID}
            availableCategories={categoriesMap[source.sourceId] ?? []}
            categoryFilter={categoryFiltersMap[source.sourceId] ?? 'all'}
            onSync={() => handleSyncSource(source.sourceId)}
            onRemove={() => handleRemoveSource(source.sourceId)}
            onToggleCategory={(cat) => handleToggleCategory(source.sourceId, cat)}
            onSetAllCategories={() => handleSetAllCategories(source.sourceId)}
          />
        ))}
      </ul>

      <form onSubmit={handleAddSource} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 14, borderTop: '1px solid var(--c-border)' }}>
        <div style={{ fontSize: 10, color: 'var(--c-text3)', letterSpacing: '0.07em', fontStyle: 'italic' }}>// ADD SOURCE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <input
            type="url"
            placeholder="https://example.com/lessons/"
            value={newSourceUrl}
            onChange={e => setNewSourceUrl(e.target.value)}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={newSourceLabel}
            onChange={e => setNewSourceLabel(e.target.value)}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={!newSourceUrl.trim()}
            style={{ ...secondaryButtonStyle, alignSelf: 'flex-start', padding: '7px 14px', opacity: !newSourceUrl.trim() ? 0.4 : 1 }}
          >
            Add source
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface SourceListItemProps {
  source: SourceRow
  status: SyncStatus
  isOfficial: boolean
  availableCategories: string[]
  categoryFilter: string[] | 'all'
  onSync: () => void
  onRemove: () => void
  onToggleCategory: (category: string) => void
  onSetAllCategories: () => void
}

function SourceListItem({
  source,
  status,
  isOfficial,
  availableCategories,
  categoryFilter,
  onSync,
  onRemove,
  onToggleCategory,
  onSetAllCategories,
}: SourceListItemProps) {
  const isSyncing = status === 'syncing'

  return (
    <li style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 7, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--c-text)' }}>{source.label}</span>
            {isOfficial && (
              <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: 'color-mix(in srgb, var(--c-accent) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--c-accent) 20%, transparent)', color: 'var(--c-accent)' }}>
                official
              </span>
            )}
            <SyncStatusBadge status={status} />
          </div>
          {source.lastSynced !== undefined ? (
            <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>synced {new Date(source.lastSynced).toLocaleString()}</div>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--c-text3)' }}>never synced</div>
          )}
          {source.url && (
            <div style={{ fontSize: 10, color: 'var(--c-text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{source.url}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <button onClick={onSync} disabled={isSyncing} style={{ ...secondaryButtonStyle, opacity: isSyncing ? 0.4 : 1 }}>
            {isSyncing ? 'Syncing…' : 'Sync'}
          </button>
          {!isOfficial && (
            <button onClick={onRemove} disabled={isSyncing} style={{ ...secondaryButtonStyle, color: 'var(--c-text3)', opacity: isSyncing ? 0.4 : 1 }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {availableCategories.length > 0 && (
        <CategoryFilterRow
          availableCategories={availableCategories}
          categoryFilter={categoryFilter}
          onToggleCategory={onToggleCategory}
          onSetAllCategories={onSetAllCategories}
        />
      )}
    </li>
  )
}

interface CategoryFilterRowProps {
  availableCategories: string[]
  categoryFilter: string[] | 'all'
  onToggleCategory: (category: string) => void
  onSetAllCategories: () => void
}

function CategoryFilterRow({ availableCategories, categoryFilter, onToggleCategory, onSetAllCategories }: CategoryFilterRowProps) {
  const isAll = categoryFilter === 'all'

  return (
    <div style={{ paddingTop: 8, borderTop: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--c-text3)' }}>Sync categories (applies to future syncs):</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        <CategoryChip label="All" isActive={isAll} isImplied={false} onClick={onSetAllCategories} />
        {availableCategories.map(cat => (
          <CategoryChip
            key={cat}
            label={cat}
            isActive={isAll || (Array.isArray(categoryFilter) && categoryFilter.includes(cat))}
            isImplied={isAll}
            onClick={() => onToggleCategory(cat)}
          />
        ))}
      </div>
    </div>
  )
}

interface CategoryChipProps {
  label: string
  isActive: boolean
  isImplied?: boolean
  onClick: () => void
}

function CategoryChip({ label, isActive, isImplied = false, onClick }: CategoryChipProps) {
  const active = isActive && !isImplied
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'inherit', cursor: 'pointer',
        border: `1px solid ${active ? 'var(--c-accent)' : isImplied ? 'color-mix(in srgb, var(--c-accent) 20%, transparent)' : 'var(--c-border)'}`,
        background: active ? 'color-mix(in srgb, var(--c-accent) 10%, transparent)' : isImplied ? 'color-mix(in srgb, var(--c-accent) 5%, transparent)' : 'var(--c-raised)',
        color: active ? 'var(--c-accent)' : isImplied ? 'color-mix(in srgb, var(--c-accent) 50%, transparent)' : 'var(--c-text3)',
      }}
    >
      {label}
    </button>
  )
}

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  if (status === 'idle') return null
  const colorMap: Record<string, string> = {
    syncing: 'var(--c-accent)',
    done: 'var(--c-green)',
    error: 'var(--c-red)',
  }
  const labelMap: Record<string, string> = {
    syncing: 'syncing…',
    done: 'up to date',
    error: 'error',
  }
  return (
    <span style={{ fontSize: 10, color: colorMap[status] ?? 'var(--c-text3)' }}>
      {labelMap[status] ?? status}
    </span>
  )
}
