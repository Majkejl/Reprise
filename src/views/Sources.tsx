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
      // Refresh categories after sync — new lessons may have introduced new categories.
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
      // Going from "all" to a specific list: exclude this category from the active set.
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
    <div className="px-4 py-8 max-w-lg mx-auto flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl text-zinc-100 font-medium tracking-tight">Sources</h1>
        <button
          onClick={handleSyncAll}
          disabled={isSyncingAll || sources.length === 0}
          className="text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-40 transition-colors"
        >
          {isSyncingAll ? 'Syncing…' : 'Sync all'}
        </button>
      </div>

      <p className="text-xs text-zinc-600 -mt-6">
        Sync is append-only — removing a lesson from a source repo does not remove it from your device.
      </p>

      <ul className="flex flex-col gap-3">
        {sources.length === 0 && (
          <li className="text-zinc-500 text-sm">No sources registered.</li>
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

      <form onSubmit={handleAddSource} className="flex flex-col gap-2 pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-500 font-medium">Add a lesson source</p>
        <input
          type="url"
          placeholder="https://example.com/lessons/"
          value={newSourceUrl}
          onChange={e => setNewSourceUrl(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <input
          type="text"
          placeholder="Label (optional)"
          value={newSourceLabel}
          onChange={e => setNewSourceLabel(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={!newSourceUrl.trim()}
          className="self-start text-xs px-3 py-1.5 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-40 transition-colors"
        >
          Add source
        </button>
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
    <li className="rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-200 truncate">{source.label}</span>
            {isOfficial ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-900 shrink-0">
                official
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700 shrink-0">
                user
              </span>
            )}
            <SyncStatusBadge status={status} />
          </div>
          {source.lastSynced !== undefined ? (
            <span className="text-xs text-zinc-600">
              Last synced {new Date(source.lastSynced).toLocaleString()}
            </span>
          ) : (
            <span className="text-xs text-zinc-700">Never synced</span>
          )}
          {source.url && (
            <span className="text-xs text-zinc-700 truncate">{source.url}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 disabled:opacity-40 transition-colors"
          >
            {isSyncing ? 'Syncing…' : 'Sync'}
          </button>
          {!isOfficial && (
            <button
              onClick={onRemove}
              disabled={isSyncing}
              className="text-xs px-2 py-1 rounded border border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-900 disabled:opacity-40 transition-colors"
            >
              Remove
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

function CategoryFilterRow({
  availableCategories,
  categoryFilter,
  onToggleCategory,
  onSetAllCategories,
}: CategoryFilterRowProps) {
  const isAll = categoryFilter === 'all'

  return (
    <div className="pt-1 border-t border-zinc-800/60 flex flex-col gap-1.5">
      <span className="text-[10px] text-zinc-600">
        Sync categories (applies to future syncs):
      </span>
      <div className="flex flex-wrap gap-1.5">
        <CategoryChip
          label="All"
          isActive={isAll}
          onClick={onSetAllCategories}
        />
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
  /** True when active because "All" is selected, not explicitly chosen. */
  isImplied?: boolean
  onClick: () => void
}

function CategoryChip({ label, isActive, isImplied = false, onClick }: CategoryChipProps) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
        isActive && !isImplied
          ? 'border-sky-700 bg-sky-900/60 text-sky-300'
          : isImplied
            ? 'border-sky-900/50 bg-sky-950/40 text-sky-600'
            : 'border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-400'
      }`}
    >
      {label}
    </button>
  )
}

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  if (status === 'idle') return null
  const styles: Record<string, string> = {
    syncing: 'text-sky-400',
    done: 'text-emerald-400',
    error: 'text-red-400',
  }
  const labels: Record<string, string> = {
    syncing: 'syncing…',
    done: 'up to date',
    error: 'error',
  }
  return (
    <span className={`text-[10px] ${styles[status] ?? ''}`}>
      {labels[status] ?? status}
    </span>
  )
}
