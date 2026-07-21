import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-[#0F2B4C]"
      initial={{ opacity: 0, scale: 1.5, filter: 'blur(20px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.img 
        src={`${import.meta.env.BASE_URL}africa-map.png`}
        className="absolute w-[120vh] h-[120vh] object-contain opacity-20 mix-blend-screen"
        initial={{ rotate: -5 }}
        animate={{ rotate: 0, scale: 1.05 }}
        transition={{ duration: 8, ease: 'easeOut' }}
      />

      <motion.div 
        className="text-center z-10"
        initial={{ opacity: 0, y: 40 }}
        animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: 1, type: 'spring', damping: 20 }}
      >
        <div className="text-[#E8A940] text-[2.5vw] font-bold tracking-[0.3em] mb-6 uppercase">
          The Future of African Finance
        </div>
        <div className="text-[12vw] font-black tracking-tighter text-[#FAF7F2] leading-none mb-4">
          IAPAY
        </div>
        <motion.div
          className="text-[2vw] text-[#FAF7F2]/60 font-medium"
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1 }}
        >
          cob-o.com
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
