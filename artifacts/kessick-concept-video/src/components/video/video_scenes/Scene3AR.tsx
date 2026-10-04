import React from 'react';
import { motion } from 'framer-motion';
import { SafeFrame, MediaFrame } from '@/lib/video';
import { KessickTowerElevation } from '../ProceduralRack';
import roomUrl from '@assets/generated_images/kessick-empty-hospitality-room.jpg';

export function Scene3AR() {
  return (
    <motion.div
      className="absolute inset-0 w-full h-full bg-black overflow-hidden font-display text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.01 }}
    >
      {/* Background Image (persists from previous scene but continues moving) */}
      <motion.div
        className="absolute inset-0 origin-center"
        initial={{ scale: 1.05, opacity: 1 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 5, ease: 'linear' }}
      >
        <MediaFrame fit="cover">
          <img src={roomUrl} alt="Room" />
        </MediaFrame>
        {/* Subtle darkening for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 mix-blend-multiply" />
      </motion.div>

      {/* AR Product Placement - scaled to actual product aspect ratio (28" W x 88.5" H) */}
      <motion.div
        className="absolute top-[10%] left-[30%] w-[22.15vh] h-[70vh] z-10"
        initial={{ opacity: 0, scale: 0.8, y: 50, rotateX: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        exit={{ opacity: 0, scale: 1.05, y: -20 }}
        transition={{ duration: 1.2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ perspective: 1000 }}
      >
        <KessickTowerElevation finish="walnut" />
        
        {/* Ground shadow for realism */}
        <div className="absolute -bottom-[2%] left-[5%] right-[5%] h-[4%] bg-black/60 blur-xl rounded-[100%]" />
      </motion.div>

      {/* AR UI Elements overlay */}
      <motion.div 
        className="absolute inset-0 pointer-events-none z-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8, delay: 1.2 }}
      >
        <div className="absolute top-[48%] left-[23%] w-[2vw] h-[2px] bg-primary/80" />
        <div className="absolute top-[48%] right-[23%] w-[2vw] h-[2px] bg-primary/80" />
        <div className="absolute bottom-[18%] left-[48%] w-[2px] h-[2vw] bg-primary/80" />
        
        <div className="absolute top-[35%] right-[20%] bg-black/80 backdrop-blur border border-primary/30 px-[1.5vw] py-[1vh] rounded-sm">
          <p className="text-[1vh] text-primary uppercase tracking-[0.2em] font-bold mb-[0.2vh]">Scale</p>
          <p className="text-[1.5vh] font-mono">1:1 True to Room</p>
        </div>
      </motion.div>

      <SafeFrame>
        {/* Scene Title / Value Prop */}
        <motion.div
          className="absolute bottom-[8vh] left-[4vw] max-w-[70vw] z-30"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 1, delay: 1.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-[1vw] mb-[2vh]">
            <div className="w-[3vw] h-[2px] bg-primary" />
            <span className="uppercase tracking-[0.2em] text-[1.5vh] text-primary font-bold">View In Your Room</span>
          </div>
          <h1 className="font-serif text-[5vh] leading-[1.1] tracking-tight">
            Believable true-scale concepts<br />
            <span className="text-white/70">build confidence immediately</span>
          </h1>
        </motion.div>
      </SafeFrame>
    </motion.div>
  );
}