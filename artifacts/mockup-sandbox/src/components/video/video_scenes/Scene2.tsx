import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 1800),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center p-8 bg-[#C98A1A] overflow-hidden"
      initial={{ opacity: 0, clipPath: 'circle(0% at 50% 100%)' }}
      animate={{ opacity: 1, clipPath: 'circle(150% at 50% 100%)' }}
      exit={{ opacity: 0, filter: 'blur(20px)', scale: 1.1 }}
      transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}africa-map.png`}
        className="absolute w-[80vh] h-[80vh] object-contain opacity-40 mix-blend-multiply"
        initial={{ rotate: -10, scale: 0.8 }}
        animate={{ rotate: 5, scale: 1.1 }}
        transition={{ duration: 10, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }}
      />
      
      <div className="relative z-10 text-center text-[#0F2B4C] flex flex-col items-center">
        <motion.p
          className="text-[2vw] font-bold tracking-widest uppercase mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        >
          The Solution
        </motion.p>
        
        <motion.h1 
          className="text-[12vw] font-black leading-none tracking-tighter"
          initial={{ opacity: 0, scale: 0.5, filter: 'blur(20px)' }}
          animate={phase >= 1 ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : { opacity: 0, scale: 0.5, filter: 'blur(20px)' }}
          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        >
          IAPAY
        </motion.h1>

        <motion.div 
          className="text-[3vw] font-bold opacity-90 mt-4"
          initial={{ opacity: 0, y: 20, clipPath: 'inset(0 100% 0 0)' }}
          animate={phase >= 2 ? { opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0)' } : { opacity: 0, y: 20, clipPath: 'inset(0 100% 0 0)' }}
          transition={{ duration: 0.8 }}
        >
          The Instant Pan-African Payment Rail
        </motion.div>
        
        <motion.div
          className="mt-8 px-6 py-2 border-2 border-[#0F2B4C] rounded-full text-[2vw] font-bold uppercase tracking-widest"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={phase >= 3 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', damping: 15 }}
        >
          PIX-Style Switch Engine
        </motion.div>
      </div>
    </motion.div>
  );
}
