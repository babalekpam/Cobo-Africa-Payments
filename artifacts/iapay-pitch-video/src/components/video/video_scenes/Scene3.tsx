import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1600),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const stats = [
    { label: 'Transfer Speed', value: '< 1s', desc: 'Instant 24/7 Switch' },
    { label: 'Currencies', value: '44+', desc: 'Cross-Currency FX' },
    { label: 'Uptime SLA', value: '99.9%', desc: 'Enterprise Grade' }
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center p-12 bg-[#0F2B4C]"
      initial={{ opacity: 0, x: '100vw' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '-50vw', scale: 0.9 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.p
        className="text-[#C98A1A] text-[2.5vw] font-bold tracking-widest uppercase mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        Traction & Scale
      </motion.p>
      
      <div className="flex flex-row gap-8 text-center w-full max-w-6xl justify-between">
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            className="flex flex-col items-center bg-[#163861]/80 backdrop-blur-md p-10 rounded-3xl flex-1 border border-[#C98A1A]/20 shadow-2xl shadow-[#000]/50"
            initial={{ opacity: 0, y: 100, rotateX: 30 }}
            animate={phase >= i + 1 ? { opacity: 1, y: 0, rotateX: 0 } : { opacity: 0, y: 100, rotateX: 30 }}
            transition={{ type: 'spring', damping: 20, stiffness: 120 }}
          >
            <div className="text-[7vw] font-black text-[#E8A940] mb-4 drop-shadow-lg">{stat.value}</div>
            <div className="text-[2.5vw] font-bold text-[#FAF7F2] uppercase tracking-wider mb-2">{stat.label}</div>
            <div className="text-[1.8vw] text-[#FAF7F2]/60">{stat.desc}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
