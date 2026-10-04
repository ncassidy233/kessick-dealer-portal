import React from 'react';
import { motion } from 'framer-motion';
import { SafeFrame, MediaFrame } from '@/lib/video';
import roomUrl from '@assets/generated_images/kessick-empty-hospitality-room.jpg';

export function Scene2Room() {
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
        initial={{ scale: 1.1, opacity: 0, filter: 'blur(20px)' }}
        animate={{ scale: 1.05, opacity: 1, filter: 'blur(0px)' }}
        exit={{ scale: 1, opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <MediaFrame fit="cover">
          <img src={roomUrl} alt="Empty Room" />
        </MediaFrame>
        {/* Subtle darkening for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40 mix-blend-multiply" />
      </motion.div>

      <SafeFrame>
        {/* Framing corners for "scan/camera" effect */}
        <motion.div 
          className="absolute inset-[15%] border-[2px] border-primary/20 pointer-events-none"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 1, delay: 0.4, ease: "easeOut" }}
        >
          <div className="absolute top-0 left-0 w-[4vw] h-[4vw] border-t-[4px] border-l-[4px] border-primary -translate-x-[2px] -translate-y-[2px]" />
          <div className="absolute top-0 right-0 w-[4vw] h-[4vw] border-t-[4px] border-r-[4px] border-primary translate-x-[2px] -translate-y-[2px]" />
          <div className="absolute bottom-0 left-0 w-[4vw] h-[4vw] border-b-[4px] border-l-[4px] border-primary -translate-x-[2px] translate-y-[2px]" />
          <div className="absolute bottom-0 right-0 w-[4vw] h-[4vw] border-b-[4px] border-r-[4px] border-primary translate-x-[2px] translate-y-[2px]" />
        </motion.div>

        {/* Scene Title / Value Prop */}
        <motion.div
          className="absolute bottom-[8vh] left-[4vw] max-w-[70vw]"
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 1, delay: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-[1vw] mb-[2vh]">
            <div className="w-[3vw] h-[2px] bg-primary" />
            <span className="uppercase tracking-[0.2em] text-[1.5vh] text-primary font-bold">Room Visualizer</span>
          </div>
          <h1 className="font-serif text-[6vh] leading-[1.1] tracking-tight">
            Start with real context:<br />
            <span className="text-white/70">the actual room</span>
          </h1>
        </motion.div>
      </SafeFrame>
    </motion.div>
  );
}