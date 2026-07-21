import { useState, useEffect, useRef } from 'react';

export function useVideoPlayer({ durations }: { durations: Record<string, number> }) {
  const [currentScene, setCurrentScene] = useState(0);
  const durationsArray = Object.values(durations);
  const hasCompletedFirstPass = useRef(false);

  useEffect(() => {
    // Tell recording environment we are starting
    if (typeof window !== 'undefined' && (window as any).startRecording) {
      (window as any).startRecording();
    }

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout>;

    const playScene = (sceneIndex: number) => {
      if (!isMounted) return;
      setCurrentScene(sceneIndex);

      const duration = durationsArray[sceneIndex] || 3000;
      
      timeoutId = setTimeout(() => {
        const nextScene = sceneIndex + 1;
        if (nextScene >= durationsArray.length) {
          if (!hasCompletedFirstPass.current) {
            hasCompletedFirstPass.current = true;
            if (typeof window !== 'undefined' && (window as any).stopRecording) {
              (window as any).stopRecording();
            }
          }
          playScene(0);
        } else {
          playScene(nextScene);
        }
      }, duration);
    };

    playScene(0);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [durationsArray.join(',')]);

  return { currentScene };
}
