import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video/hooks';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

const SCENE_DURATIONS = {
  problem: 4000,
  solution: 4500,
  traction: 4000,
  opportunity: 4000,
  vision: 4500
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0F2B4C] text-[#FAF7F2] font-sans">
      {/* Background layer */}
      <div className="absolute inset-0">
        <video 
          className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-screen"
          src={`${import.meta.env.BASE_URL}bg-nodes.mp4`}
          autoPlay 
          muted 
          loop 
          playsInline
        />
        <div className="absolute inset-0 bg-[#0F2B4C]/40 mix-blend-multiply" />
      </div>

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="problem" />}
        {currentScene === 1 && <Scene2 key="solution" />}
        {currentScene === 2 && <Scene3 key="traction" />}
        {currentScene === 3 && <Scene4 key="opportunity" />}
        {currentScene === 4 && <Scene5 key="vision" />}
      </AnimatePresence>
    </div>
  );
}
