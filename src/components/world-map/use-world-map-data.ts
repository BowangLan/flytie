import { useAction } from 'convex/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { AdsbAircraft } from './flights'
import { createWorldMapDataSource } from './data-source'
import type { WorldMapDataSnapshot, WorldMapDataSource } from './data-source'
import { useFlightsStore } from '#/store/flights-store'
import type { AircraftHistoryMap } from './replay-utils'
import { buildReplayAircraft, appendAircraftSnapshot } from './replay-utils'
import { useReplayTimelineStore } from '#/store/replay-timeline-store'
import { useSelectedFlightStore } from '#/store/selected-flight.store'

function createDefaultWorldMapDataSource(
  fetchAircraftAll: () => Promise<string>,
): WorldMapDataSource {
  return createWorldMapDataSource({
    loadAircraft: async () => {
      const response = await fetchAircraftAll()
      const data = JSON.parse(response) as { ac: AdsbAircraft[] }
      return data.ac
    },
  })
}

// TODO: Make this configurable
const REFRESH_INTERVAL_MS = 10_000 // 10 seconds

export function useWorldMapData(
  dataSource?: WorldMapDataSource,
): WorldMapDataSnapshot {
  const fetchAircraftAll = useAction(api.lib.adbsexchange.fetchAircraftAll)
  const selectedIcao24 = useSelectedFlightStore((state) => state.selectedIcao24)
  const scrubbedTimestamp = useReplayTimelineStore(
    (state) => state.scrubbedTimestamp,
  )
  const [aircraft, setAircraft] = useState<AdsbAircraft[]>([])
  const historyRef = useRef<AircraftHistoryMap>(new Map())
  const [historyVersion, setHistoryVersion] = useState(0)
  const [lastSnapshotTimestamp, setLastSnapshotTimestamp] = useState<number | null>(
    null,
  )

  const resolvedDataSource = useMemo(
    () => dataSource ?? createDefaultWorldMapDataSource(fetchAircraftAll),
    [dataSource, fetchAircraftAll],
  )

  useEffect(() => {
    let cancelled = false

    const loadAircraft = async () => {
      try {
        const nextAircraft = await resolvedDataSource.loadAircraft()
        if (!cancelled) {
          const snapshotTimestamp = Date.now()
          appendAircraftSnapshot(historyRef.current, nextAircraft, snapshotTimestamp)
          setAircraft(nextAircraft)
          setLastSnapshotTimestamp(snapshotTimestamp)
          setHistoryVersion((version) => version + 1)
        }
      } catch (error) {
        console.error('ADSBExchange fetch failed:', error)
      }
    }

    loadAircraft()
    const intervalId = setInterval(loadAircraft, REFRESH_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [resolvedDataSource])

  const effectiveAircraft = useMemo(() => {
    if (!scrubbedTimestamp) return aircraft
    if (!lastSnapshotTimestamp || scrubbedTimestamp >= lastSnapshotTimestamp) {
      return aircraft
    }
    return buildReplayAircraft(historyRef.current, scrubbedTimestamp)
  }, [aircraft, historyVersion, lastSnapshotTimestamp, scrubbedTimestamp])

  useEffect(() => {
    useFlightsStore
      .getState()
      .setFlightsFromViewport(effectiveAircraft, selectedIcao24)
  }, [effectiveAircraft, selectedIcao24])

  return { aircraft: effectiveAircraft }
}
