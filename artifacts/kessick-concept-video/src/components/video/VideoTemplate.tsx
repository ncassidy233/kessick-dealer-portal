import {
  VideoCanvas,
  VideoPausedContext,
  type VideoAspectRatio,
  useVideoPlayer,
} from '@/lib/video';
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { Scene1Product } from './video_scenes/Scene1Product';
import { Scene2Room } from './video_scenes/Scene2Room';
import { Scene3AR } from './video_scenes/Scene3AR';
import { Scene4Finish } from './video_scenes/Scene4Finish';
import { Scene5CTA } from './video_scenes/Scene5CTA';

import logoUrl from '@assets/kessick-logo-white.svg';

export const SCENE_DURATIONS = {
  product: 4000,
  room: 6000,
  ar: 5000,
  finish: 6000,
  cta: 6000,
};

const VIDEO_ASPECT_RATIO: VideoAspectRatio = '16:9';

const SCENE_COMPONENTS: Record<string, React.ComponentType> = {
  product: Scene1Product,
  room: Scene2Room,
  ar: Scene3AR,
  finish: Scene4Finish,
  cta: Scene5CTA,
};

const SCENE_START_SEC = (() => {
  const offsets: Record<string, number> = {};
  let cumulativeMs = 0;
  for (const [key, duration] of Object.entries(SCENE_DURATIONS)) {
    offsets[key] = cumulativeMs / 1000;
    cumulativeMs += duration;
  }
  return offsets;
})();

export default function VideoTemplate({
  durations = SCENE_DURATIONS,
  loop = true,
  paused = false,
  muted = false,
  onSceneChange,
}: {
  durations?: Record<string, number>;
  loop?: boolean;
  paused?: boolean;
  muted?: boolean;
  onSceneChange?: (sceneKey: string) => void;
} = {}) {
  const { currentSceneKey } = useVideoPlayer({ durations, loop, paused });
  const baseSceneKey = currentSceneKey.replace(/_r[12]$/, '');
  const sceneIndex = Object.keys(SCENE_DURATIONS).indexOf(baseSceneKey);
  const SceneComponent = SCENE_COMPONENTS[baseSceneKey];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSceneKeyRef = useRef<string | null>(null);

  useEffect(() => onSceneChange?.(currentSceneKey), [currentSceneKey, onSceneChange]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
    if (paused) {
      audio.pause();
      return;
    }
    if (lastSceneKeyRef.current !== currentSceneKey) {
      lastSceneKeyRef.current = currentSceneKey;
      const targetTime = SCENE_START_SEC[baseSceneKey] ?? 0;
      if (Math.abs(audio.currentTime - targetTime) > 0.18) {
        audio.currentTime = targetTime;
      }
    }
    audio.play().catch(() => {});
  }, [baseSceneKey, currentSceneKey, muted, paused]);

  return (
    <VideoCanvas
      aspectRatio={VIDEO_ASPECT_RATIO}
      style={{ backgroundColor: 'var(--color-bg-dark)' }}
    >
      {/* Persistent Logo */}
      <motion.div
        className="absolute z-50 pointer-events-none"
        animate={{
          top: sceneIndex === 4 ? '8vh' : '4vh',
          left: sceneIndex === 4 ? '50%' : '4vw',
          x: sceneIndex === 4 ? '-50%' : '0%',
          opacity: sceneIndex === 0 ? 0 : 1
        }}
        initial={{ top: '4vh', left: '4vw', x: '0%', opacity: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
      >
        <img src={logoUrl} alt="Kessick Logo" className="h-[4vh] w-auto opacity-80" />
      </motion.div>

      {/* Persistent Concept Label */}
      <motion.div
        className="absolute z-50 top-[4vh] right-[4vw] bg-primary/20 text-primary px-[1vw] py-[0.5vh] uppercase tracking-widest text-[1.2vh] font-bold border border-primary/30 backdrop-blur-sm pointer-events-none"
        animate={{ opacity: 1 }}
        initial={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
      >
        Concept Demo / Future Experience
      </motion.div>

      <VideoPausedContext.Provider value={paused}>
        <AnimatePresence mode="sync">
          {SceneComponent && <SceneComponent key={currentSceneKey} />}
        </AnimatePresence>
      </VideoPausedContext.Provider>
      <audio
        ref={audioRef}
        src={`${import.meta.env.BASE_URL}audio/bg_music.mp3`}
        preload="auto"
        autoPlay
        muted={muted}
      />
    </VideoCanvas>
  );
}