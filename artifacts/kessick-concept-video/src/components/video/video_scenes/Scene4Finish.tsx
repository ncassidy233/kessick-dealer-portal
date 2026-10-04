import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SafeFrame, MediaFrame } from '@/lib/video';
import { KessickTowerElevation } from '../ProceduralRack';
import roomUrl from '@assets/generated_images/kessick-empty-hospitality-room.jpg';

export function Scene4Finish() {
  const [activeFinish, setActiveFinish] = useState<'walnut' | 'matte-black'>('walnut');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Choreograph the finish switch
    const timers = [
      setTimeout(() => setActiveFinish('matte-black'), 2500),
      setTimeout(() => setIsUpdating(true), 2500),
      setTimeout(() => setIsUpdating(false), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full bg-black overflow-hidden font-display text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.99 }}
    >
      {/* Background Image */}
      <motion.div
        className="absolute inset-0 origin-center"
        initial={{ scale: 1 }}
        animate={{ scale: 1.05 }}
        exit={{ opacity: 0, filter: 'blur(20px)' }}
        transition={{ duration: 6, ease: 'linear' }}
      >
        <MediaFrame fit="cover">
          <img src={roomUrl} alt="Room" />
        </MediaFrame>
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 mix-blend-multiply" />
      </motion.div>

      {/* AR Product Placement - scaled to actual product aspect ratio (28" W x 88.5" H) */}
      <motion.div
        className="absolute top-[10%] left-[30%] w-[22.15vh] h-[70vh] z-10"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
      >
        <AnimatePresence mode="popLayout">
          <motion.div
            key={activeFinish}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="w-full h-full"
          >
            <KessickTowerElevation finish={activeFinish} />
          </motion.div>
        </AnimatePresence>
        
        {/* Ground shadow for realism */}
        <div className="absolute -bottom-[2%] left-[5%] right-[5%] h-[4%] bg-black/60 blur-xl rounded-[100%]" />
      </motion.div>

      <SafeFrame>
        {/* UI Overlay for Switching */}
        <motion.div
          className="absolute right-[4vw] top-[25vh] bg-black/90 backdrop-blur-md border border-neutral-800 p-[3vh] w-[20vw] z-40 shadow-2xl"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <h3 className="text-[1.2vh] font-bold uppercase tracking-[0.2em] mb-[3vh] text-neutral-400 border-b border-neutral-800 pb-[1.5vh]">Finish Selection</h3>
          
          <div className="grid grid-cols-2 gap-[1vw] mb-[3vh]">
            <div className={`p-[1.5vh] border transition-colors ${activeFinish === 'walnut' ? 'border-primary bg-primary/10' : 'border-neutral-800'}`}>
              <div className="w-full h-[4vh] bg-[#4a3b37] mb-[1.5vh]" />
              <p className="text-[1.2vh] text-center font-medium">Walnut</p>
            </div>
            <div className={`p-[1.5vh] border transition-colors ${activeFinish === 'matte-black' ? 'border-primary bg-primary/10' : 'border-neutral-800'}`}>
              <div className="w-full h-[4vh] bg-[#1a1a1a] mb-[1.5vh]" />
              <p className="text-[1.2vh] text-center font-medium">Matte Black</p>
            </div>
          </div>

          <div className="h-[2vh] flex items-center">
            {isUpdating ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex items-center gap-[1vw] text-[1.2vh]"
              >
                <div className="w-[0.8vh] h-[0.8vh] bg-primary animate-pulse rounded-full" />
                <span className="text-primary">Applying Material...</span>
              </motion.div>
            ) : activeFinish === 'matte-black' ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center gap-[1vw] text-[1.2vh]"
              >
                <div className="w-[0.8vh] h-[0.8vh] bg-green-500 rounded-full" />
                <span className="text-green-500">Material Applied</span>
              </motion.div>
            ) : null}
          </div>
        </motion.div>

        {/* Scene Title / Value Prop */}
        <motion.div
          className="absolute bottom-[8vh] left-[4vw] max-w-[50vw] z-30"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 1, delay: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-[1vw] mb-[2vh]">
            <div className="w-[3vw] h-[2px] bg-primary" />
            <span className="uppercase tracking-[0.2em] text-[1.5vh] text-primary font-bold">The Iteration</span>
          </div>
          <h1 className="font-serif text-[4.5vh] leading-[1.1] tracking-tight">
            Instantly validate aesthetic choices<br />
            <span className="text-white/70">without waiting for new renders</span>
          </h1>
        </motion.div>
      </SafeFrame>
    </motion.div>
  );
}