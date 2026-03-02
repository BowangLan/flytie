import { create } from 'zustand'
import type { CameraState } from '#/components/world-map/map-legend'
import { INITIAL_CAMERA_STATE } from '#/components/world-map/world-map-config'
import type { CursorCoord } from '#/components/world-map/world-map-config'

function isSameCameraState(a: CameraState, b: CameraState) {
  return (
    a.lon[0] === b.lon[0] &&
    a.lon[1] === b.lon[1] &&
    a.lat[0] === b.lat[0] &&
    a.lat[1] === b.lat[1] &&
    a.zoom === b.zoom
  )
}

type CameraStateStore = {
  cameraState: CameraState
  setCameraState: (next: CameraState | null) => void
  cursorCoord: CursorCoord
  setCursorCoord: (coord: CursorCoord) => void
}

export const useCameraStateStore = create<CameraStateStore>()((set, get) => ({
  cameraState: INITIAL_CAMERA_STATE,
  setCameraState: (next) => {
    if (!next) return
    if (isSameCameraState(get().cameraState, next)) return
    set({ cameraState: next })
  },
  cursorCoord: null,
  setCursorCoord: (coord) => set({ cursorCoord: coord }),
}))
