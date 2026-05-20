import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import { Nav } from '@/components/Nav'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { ErrorNotification } from '@/components/ErrorNotification'
import { useUIStore } from '@/stores/uiStore'
import { Dashboard } from '@/views/Dashboard'
import { StudySession } from '@/views/StudySession'
import { LessonBrowser } from '@/views/LessonBrowser'
import { LessonReader } from '@/views/LessonReader'
import { ScopePicker } from '@/views/ScopePicker'
import { Sources } from '@/views/Sources'
import { Settings } from '@/views/Settings'

export function App() {
  const loadScope = useUIStore(s => s.loadScope)

  useEffect(() => {
    void loadScope()
  }, [loadScope])

  return (
    <HashRouter>
      <div className="min-h-screen flex flex-col bg-zinc-950">
        <OfflineIndicator />
        <Nav />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/study" element={<StudySession />} />
            <Route path="/lessons" element={<LessonBrowser />} />
            <Route path="/lessons/:sourceId/:lessonId" element={<LessonReader />} />
            <Route path="/scope" element={<ScopePicker />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <ErrorNotification />
      </div>
    </HashRouter>
  )
}
