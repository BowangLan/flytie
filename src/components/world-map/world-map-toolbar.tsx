import { PlayIcon, SearchIcon } from "lucide-react";
import { Button } from "../ui/button";
import { useFlightSearchStore } from "#/store/flight-search-store";
import { useReplayTimelineStore } from "#/store/replay-timeline-store";

export function WorldMapToolbar() {
  const replayTimelineActive = useReplayTimelineStore((state) => state.active)
  const setReplayTimelineActive = useReplayTimelineStore((state) => state.setActive)
  const setSearchOpen = useFlightSearchStore((state) => state.setOpen)
  const searchOpen = useFlightSearchStore((state) => state.open)

  return (
    <div className="fixed top-6 left-6 z-90 cursor-pointer">
      <div className="flex items-center gap-2 p-2 rounded-lg bg-neutral-900/50 backdrop-blur-sm border border-neutral-500/20">
        <Button variant={!replayTimelineActive ? "ghost" : "default"} onClick={() => setReplayTimelineActive(!replayTimelineActive)} size="icon">
          <PlayIcon className="size-4" />
        </Button>
        <Button variant={searchOpen ? "default" : "ghost"} size="icon" onClick={() => setSearchOpen(!searchOpen)}>
          <SearchIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}