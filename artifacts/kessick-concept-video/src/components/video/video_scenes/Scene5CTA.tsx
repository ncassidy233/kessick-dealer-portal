import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { SafeFrame } from '@/lib/video';
import roomUrl from '@assets/generated_images/kessick-empty-hospitality-room.jpg';

export function Scene5CTA() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    // Choreograph the cascade of CTA highlights
    const timers = [
      setTimeout(() => setActiveStep(1), 1500),
      setTimeout(() => setActiveStep(2), 3000),
      setTimeout(() => setActiveStep(3), 4500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div
      className="absolute inset-0 w-full h-full bg-neutral-950 overflow-hidden font-display text-white"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.03, filter: 'blur(12px)' }}
    >
      {/* Background (very blurred room) */}
      <motion.div
        className="absolute inset-0 origin-center opacity-20"
        initial={{ filter: 'blur(20px)', scale: 1.05 }}
        animate={{ filter: 'blur(40px)', scale: 1 }}
        transition={{ duration: 6, ease: 'linear' }}
      >
        <img src={roomUrl} alt="Room blur" className="w-full h-full object-cover" />
      </motion.div>
      <div className="absolute inset-0 bg-neutral-950/80 mix-blend-multiply" />

      <SafeFrame>
        {/* CTA Cards Container */}
        <div className="absolute top-[35vh] left-[10vw] right-[10vw] h-[40vh] flex gap-[2vw]">
          <CTACard
            title="Save Concept"
            description="Store this design in your workspace for later review and refinement."
            icon="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
            delay={0.4}
            isActive={activeStep === 1}
          />
          <CTACard
            title="Find a Dealer"
            description="Share this concept with a certified Kessick dealer for pricing and fulfillment."
            icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            delay={0.6}
            isActive={activeStep === 2}
          />
          <CTACard
            title="Design Request"
            description="Submit to our team to refine into a comprehensive proposal."
            icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            delay={0.8}
            isActive={activeStep === 3}
          />
        </div>

        {/* Final Value Prop */}
        <motion.div
          className="absolute bottom-[8vh] left-0 w-full text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center justify-center gap-[1vw] mb-[2vh]">
            <div className="w-[3vw] h-[2px] bg-primary" />
            <span className="uppercase tracking-[0.2em] text-[1.5vh] text-primary font-bold">The Result</span>
            <div className="w-[3vw] h-[2px] bg-primary" />
          </div>
          <h2 className="font-serif text-[4vh] leading-[1.1] tracking-tight">
            Connects inspiration directly to a sales lead
          </h2>
        </motion.div>
      </SafeFrame>
    </motion.div>
  );
}

function CTACard({ title, description, icon, delay, isActive }: { title: string, description: string, icon: string, delay: number, isActive: boolean }) {
  return (
    <motion.div
      className={`flex-1 border p-[3vw] flex flex-col justify-between transition-colors duration-500 ${isActive ? 'bg-primary/10 border-primary' : 'bg-neutral-900/50 border-neutral-800'}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <div>
        <svg className={`w-[4vh] h-[4vh] mb-[3vh] transition-colors duration-500 ${isActive ? 'text-primary' : 'text-neutral-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
        <h3 className="font-serif text-[3vh] mb-[1.5vh]">{title}</h3>
        <p className="text-[1.5vh] text-neutral-400 leading-relaxed">{description}</p>
      </div>
      
      <div className={`flex items-center text-[1.2vh] uppercase tracking-[0.2em] font-bold mt-[4vh] transition-colors duration-500 ${isActive ? 'text-primary' : 'text-neutral-500'}`}>
        Select <span className={`ml-[1vw] transition-transform duration-500 ${isActive ? 'translate-x-2' : ''}`}>→</span>
      </div>
    </motion.div>
  );
}