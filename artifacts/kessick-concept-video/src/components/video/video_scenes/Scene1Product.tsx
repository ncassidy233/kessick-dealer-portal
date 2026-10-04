import React from 'react';
import { motion } from 'framer-motion';
import { SafeFrame, VideoText } from '@/lib/video';
import { KessickTowerElevation } from '../ProceduralRack';

export function Scene1Product() {
  return (
    <motion.div
      className="absolute inset-0 w-full h-full bg-neutral-900 overflow-hidden font-display text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
    >
      {/* Background Gradient */}
      <motion.div 
        className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-800 to-neutral-950"
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />
      
      {/* Noise Texture */}
      <div className="absolute inset-0 opacity-10 pointer-events-none mix-blend-overlay video-noise" />

      {/* Rack container - scaled to actual product aspect ratio (28" W x 88.5" H) */}
      <motion.div
        className="absolute top-1/2 left-1/2 w-[22.15vh] h-[70vh]"
        style={{ originX: 0.5, originY: 0.5 }}
        initial={{ x: '-50%', y: '-40%', opacity: 0, scale: 0.9, rotateX: 10 }}
        animate={{ x: '-50%', y: '-50%', opacity: 1, scale: 1, rotateX: 0 }}
        exit={{ x: '-50%', y: '-60%', opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      >
        <KessickTowerElevation finish="walnut" />
      </motion.div>

      <SafeFrame>
        {/* Scene Title / Value Prop */}
        <motion.div
          className="absolute bottom-[8vh] left-[4vw] max-w-[60vw]"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.8, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-[1vw] mb-[2vh]">
            <div className="w-[3vw] h-[2px] bg-primary" />
            <span className="uppercase tracking-[0.2em] text-[1.5vh] text-primary font-bold">3D Product Viewer</span>
          </div>
          <h1 className="font-serif text-[6vh] leading-[1.1] tracking-tight">
            Premium Architectural<br />
            <span className="text-neutral-400">Wine Storage</span>
          </h1>
        </motion.div>
      </SafeFrame>
    </motion.div>
  );
}