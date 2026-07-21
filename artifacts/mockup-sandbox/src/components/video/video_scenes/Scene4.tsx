import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1200),
      setTimeout(() => setPhase(3), 2000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-[#FAF7F2] overflow-hidden"
      initial={{ opacity: 0, y: '100vh' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, filter: 'blur(10px)', scale: 1.2 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Decorative lines */}
      <motion.div 
        className="absolute top-1/4 left-0 w-full h-[1px] bg-[#C98A1A]/30"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, ease: "circOut" }}
      />
      <motion.div 
        className="absolute bottom-1/4 left-0 w-full h-[1px] bg-[#C98A1A]/30"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.5, ease: "circOut", delay: 0.2 }}
      />

      <div className="text-center text-[#0F2B4C] max-w-5xl z-10">
        <motion.p
          className="text-[#C98A1A] text-[2.5vw] font-bold tracking-widest uppercase mb-8"
          initial={{ opacity: 0 }}
          animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }}
        >
          Market Opportunity
        </motion.p>
        
        <motion.h2 
          className="text-[5vw] font-black mb-8 leading-tight tracking-tight"
          initial={{ opacity: 0, y: 30 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        >
          Connecting <span className="text-[#C98A1A]">70+ Countries</span><br/>to the Continent
        </motion.h2>
        
        <div className="flex flex-row gap-6 justify-center mt-12">
          {['US', 'Canada', 'Europe', 'Africa'].map((region, i) => (
            <motion.div
              key={region}
              className="text-[3vw] font-bold py-4 px-8 border-2 border-[#0F2B4C]/20 rounded-full"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
              transition={{ delay: i * 0.1, type: 'spring' }}
            >
              {region}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
