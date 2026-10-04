import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
} from 'lucide-react';

import VideoTemplate, { SCENE_DURATIONS } from './VideoTemplate';
import { useSceneControls } from './useSceneControls';

const SCENE_DETAILS: Record<string, { title: string; filePath: string }> = {
  product: { title: '3D Product Viewer', filePath: 'src/components/video/video_scenes/Scene1Product.tsx' },
  room: { title: 'Room Visualizer', filePath: 'src/components/video/video_scenes/Scene2Room.tsx' },
  ar: { title: 'View In Your Room', filePath: 'src/components/video/video_scenes/Scene3AR.tsx' },
  finish: { title: 'Finish Configuration', filePath: 'src/components/video/video_scenes/Scene4Finish.tsx' },
  cta: { title: 'Sales Conversion', filePath: 'src/components/video/video_scenes/Scene5CTA.tsx' },
};

const PROGRESS_TICK_MS = 60;

function formatTime(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
}

function PlaybackStatus({
  sceneKeys,
  activeIndex,
  activeDuration,
  activeStartTime,
  totalDuration,
  tick,
  paused,
  onJumpTo,
}: {
  sceneKeys: string[];
  activeIndex: number;
  activeDuration: number;
  activeStartTime: number;
  totalDuration: number;
  tick: number;
  paused: boolean;
  onJumpTo: (index: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const elapsedBaseRef = useRef(0);

  useEffect(() => {
    setElapsed(0);
    elapsedBaseRef.current = 0;
  }, [tick]);
  useEffect(() => {
    if (paused) return;
    const start = performance.now();
    const id = window.setInterval(
      () => setElapsed(elapsedBaseRef.current + performance.now() - start),
      PROGRESS_TICK_MS,
    );
    return () => {
      window.clearInterval(id);
      elapsedBaseRef.current += performance.now() - start;
    };
  }, [paused, tick]);

  const progress = activeDuration ? Math.min(1, elapsed / activeDuration) : 0;
  const totalElapsed = Math.min(
    totalDuration,
    activeStartTime + Math.min(elapsed, activeDuration),
  );

  return (
    <>
      <div className="flex flex-1 items-center gap-[0.4vw]">
        {sceneKeys.map((key, index) => (
          <button
            key={key}
            type="button"
            onClick={() => onJumpTo(index)}
            className="relative h-[1.1vh] min-h-[6px] flex-1 overflow-hidden rounded-full bg-white/20"
            aria-label={`Jump to ${SCENE_DETAILS[key]?.title ?? `scene ${index + 1}`}`}
          >
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-white/90"
              style={{ width: `${index === activeIndex ? progress * 100 : 0}%` }}
            />
          </button>
        ))}
      </div>
      <span className="shrink-0 font-mono text-[1.5vh] text-white/65">
        {activeIndex + 1}/{sceneKeys.length}
      </span>
      <span className="min-w-[10ch] shrink-0 text-right font-mono text-[1.5vh] text-white/80">
        {formatTime(totalElapsed)} / {formatTime(totalDuration)}
      </span>
    </>
  );
}

export default function VideoWithControls() {
  const isIframed = typeof window !== 'undefined' && window.self !== window.top;
  const controls = useSceneControls(SCENE_DURATIONS);
  const [muted, setMuted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [tapPinned, setTapPinned] = useState(false);
  const sensorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!controls.paused) return;
    const frozen = document
      .getAnimations()
      .filter((animation) => animation.playState === 'running');
    frozen.forEach((animation) => animation.pause());
    return () => frozen.forEach((animation) => animation.play());
  }, [controls.paused]);

  useEffect(() => {
    if (!(collapsed && tapPinned)) return;
    const handleOutside = (event: PointerEvent) => {
      if (
        event.pointerType !== 'mouse' &&
        sensorRef.current &&
        !sensorRef.current.contains(event.target as Node)
      ) {
        setTapPinned(false);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [collapsed, tapPinned]);

  const handleJump = useCallback(
    (index: number) => {
      controls.jumpTo(index);
      const key = controls.sceneKeys[index];
      const detail = SCENE_DETAILS[key];
      if (!detail) return;
      window.parent.postMessage(
        {
          type: 'REPLIT_VIDEO_SCENE_SELECTED',
          payload: {
            sceneIndex: index,
            sceneCount: controls.sceneKeys.length,
            sceneTitle: detail.title,
            filePath: detail.filePath,
            lineNumber: 1,
          },
        },
        '*',
      );
    },
    [controls],
  );

  if (!isIframed) return <VideoTemplate />;
  const barVisible = !collapsed || hovering || tapPinned;

  return (
    <div className="relative h-screen w-full">
      <VideoTemplate
        key={controls.mountKey}
        durations={controls.durations}
        paused={controls.paused}
        muted={muted}
        onSceneChange={controls.onSceneChange}
      />
      <div
        ref={sensorRef}
        className="absolute inset-x-0 bottom-0 z-[100] flex h-1/4 flex-col justify-end"
        onPointerEnter={(event) => event.pointerType === 'mouse' && setHovering(true)}
        onPointerLeave={(event) => event.pointerType === 'mouse' && setHovering(false)}
        onPointerDown={(event) =>
          event.pointerType !== 'mouse' && collapsed && setTapPinned(true)
        }
      >
        <div className="flex-1" />
        <div
          className={`flex items-center gap-[0.8vw] bg-black/65 px-[1.5vw] py-[1.4vh] backdrop-blur-md transition-all ${
            barVisible
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-full opacity-0'
          }`}
        >
          <button type="button" onClick={controls.togglePause} className="text-white/70" aria-label={controls.paused ? 'Play' : 'Pause'}>
            {controls.paused ? <Play className="h-[3vh] w-[3vh]" /> : <Pause className="h-[3vh] w-[3vh]" />}
          </button>
          <button type="button" onClick={controls.toggleLock} className={controls.locked ? 'text-primary' : 'text-white/70'} aria-label="Loop current scene">
            <Repeat className="h-[3vh] w-[3vh]" />
          </button>
          <button type="button" onClick={() => setMuted((value) => !value)} className="text-white/70" aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? <VolumeX className="h-[3vh] w-[3vh]" /> : <Volume2 className="h-[3vh] w-[3vh]" />}
          </button>
          <span className="h-[3vh] w-px bg-white/20" />
          <PlaybackStatus
            {...controls}
            onJumpTo={handleJump}
          />
          <button
            type="button"
            onClick={() => {
              setCollapsed((value) => !value);
              setHovering(false);
              setTapPinned(false);
            }}
            className="text-white/70"
            aria-label={collapsed ? 'Show controls' : 'Hide controls'}
          >
            {collapsed ? <ChevronUp className="h-[3vh] w-[3vh]" /> : <ChevronDown className="h-[3vh] w-[3vh]" />}
          </button>
        </div>
      </div>
    </div>
  );
}