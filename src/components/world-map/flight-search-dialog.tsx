import { useDeferredValue, useEffect, useId, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { Search } from 'lucide-react'
import type { AdsbAircraft } from './flights'
import { cn } from '#/lib/utils'
import { useFlightSearchStore } from '#/store/flight-search-store'
import { searchFlightsLocally, useFlightSearchIndex } from './use-flight-search'

type FlightSearchDialogProps = {
  aircraft: AdsbAircraft[]
  onSelectIcao24: (icao24: string) => void
}

export function FlightSearchDialog({
  aircraft,
  onSelectIcao24,
}: FlightSearchDialogProps) {
  const open = useFlightSearchStore((state) => state.open)
  const setOpen = useFlightSearchStore((state) => state.setOpen)
  const toggleOpen = useFlightSearchStore((state) => state.toggleOpen)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const inputId = useId()
  const deferredQuery = useDeferredValue(query)

  const indexedAircraft = useFlightSearchIndex(aircraft)
  const normalizedQuery = deferredQuery.trim().toUpperCase()
  const results = searchFlightsLocally(indexedAircraft, deferredQuery)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isOpenShortcut =
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k' &&
        !event.shiftKey &&
        !event.altKey

      if (!isOpenShortcut) return
      event.preventDefault()
      toggleOpen()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggleOpen])

  useEffect(() => {
    if (!open) {
      setQuery('')
      return
    }

    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [open])

  const emptyState =
    normalizedQuery.length === 0
      ? 'Type an ICAO24 or flight number to filter the flights already on the map.'
      : `No local flight matches "${normalizedQuery}".`

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className={cn(
            'fixed top-[12vh] left-1/2 z-50 w-[min(92vw,40rem)] -translate-x-1/2 overflow-hidden rounded-[1.75rem] border border-white/12 bg-zinc-950/95 text-white shadow-[0_32px_96px_rgba(0,0,0,0.5)] backdrop-blur-xl focus:outline-none',
            'data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_52%)] p-4">
            <DialogPrimitive.Title className="text-sm font-semibold tracking-[0.18em] text-white/55 uppercase">
              Flight Search
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-sm text-white/65">
              Search locally by ICAO24 or flight number.
            </DialogPrimitive.Description>
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <Search className="size-4 shrink-0 text-cyan-200" />
              <label htmlFor={inputId} className="sr-only">
                Search flights
              </label>
              <input
                id={inputId}
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="A84D7B or DAL123"
                autoComplete="off"
                spellCheck={false}
                className="w-full bg-transparent text-base text-white outline-none placeholder:text-white/35"
              />
            </div>
          </div>

          <div className="max-h-[min(60vh,32rem)] overflow-y-auto p-2">
            {results.length > 0 ? (
              <div className="space-y-1">
                {results.map((result) => {
                  const flightNumber = result.flightNumber || 'Unknown'
                  const registration = result.aircraft.r?.trim() || 'Unknown'
                  const aircraftType = result.aircraft.t?.trim() || 'Unknown'

                  return (
                    <button
                      key={result.icao24}
                      type="button"
                      onClick={() => {
                        onSelectIcao24(result.icao24.toLowerCase())
                        setOpen(false)
                      }}
                      className="flex w-full items-start justify-between gap-3 rounded-2xl border border-transparent px-4 py-3 text-left transition hover:border-cyan-300/25 hover:bg-white/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-white">
                            {flightNumber}
                          </span>
                          <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-2 py-0.5 font-mono text-[11px] tracking-[0.16em] text-cyan-100 uppercase">
                            {result.icao24}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-sm text-white/60">
                          {registration} · {aircraftType}
                        </div>
                      </div>
                      <div className="shrink-0 text-right text-xs text-white/45">
                        <div>{Math.round(result.aircraft.gs || 0)} kt</div>
                        <div>{Math.round(result.aircraft.alt_baro || 0)} ft</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="px-4 py-8 text-center text-sm text-white/55">
                {emptyState}
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
