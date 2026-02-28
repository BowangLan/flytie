import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

const WorldMap = lazy(() => import('../components/world-map'))

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <>
      <Suspense fallback={<div className="fixed inset-0 z-0" />}>
        <WorldMap />
      </Suspense>
      <div className="pointer-events-none fixed bottom-5 right-5 z-10 text-right">
        <p className="text-[11px] text-white/25 tracking-wide">
          Scroll to zoom · Drag to pan · Ctrl/Cmd K to search
        </p>
      </div>
    </>
  )
}
