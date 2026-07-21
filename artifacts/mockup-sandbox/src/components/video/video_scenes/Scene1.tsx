import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene1() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
      setTimeout(() => setPhase(3), 3000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-8"
      initial={{ opacity: 0, scale: 1.1 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, y: -50, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative z-10 text-center max-w-5xl">
        <motion.p
          className="text-[#E8A940] text-[2vw] font-bold tracking-widest uppercase mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          The Problem
        </motion.p>
        
        <h1 className="text-[6vw] font-black leading-tight mb-12">
          {'Cross-border payments in Africa are'.split(' ').map((word, i) => (
            <motion.span 
              key={i} 
              className="inline-block mr-3"
              initial={{ opacity: 0, y: 40, rotateX: -40 }}
              animate={phase >= 1 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 40, rotateX: -40 }}
              transition={{ delay: i * 0.1, duration: 0.6, type: 'spring' }}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <div className="flex justify-center gap-12 text-[4vw] font-bold text-[#FAF7F2]/90">
          <motion.div 
            initial={{ opacity: 0, x: -30, filter: 'blur(5px)' }}
            animate={phase >= 2 ? { opacity: 1, x: 0, filter: 'blur(0px)' } : { opacity: 0, x: -30, filter: 'blur(5px)' }}
            transition={{ type: 'spring', damping: 20 }}
          >
            Fragmented
          </motion.div>
          <motion.div 
            className="text-[#C98A1A]"
            initial={{ opacity: 0, y: 30, filter: 'blur(5px)' }}
            animate={phase >= 2 ? { opacity: 1, y: 0, filter: 'blur(0px)' } : { opacity: 0, y: 30, filter: 'blur(5px)' }}
            transition={{ delay: 0.2, type: 'spring', damping: 20 }}
          >
            Slow
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30, filter: 'blur(5px)' }}
            animate={phase >= 2 ? { opacity: 1, x: 0, filter: 'blur(0px)' } : { opacity: 0, x: 30, filter: 'blur(5px)' }}
            transition={{ delay: 0.4, type: 'spring', damping: 20 }}
          >
            Expensive
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
