import React, { useEffect, useState, useRef } from 'react';
import { Target, Calendar, Zap, Smile, Sparkles, User, Star } from 'lucide-react';
import './IntroBubbles.css';

const bubblesData = [
  { text: 'Set Goals', color: 'primary', icon: <Target size={20} /> },
  { text: 'Track Progress', color: 'blue', icon: <Zap size={20} /> },
  { text: 'Plan Workouts', color: 'orange', icon: <Calendar size={20} /> },
  { text: 'Stay Motivated', color: 'purple', icon: <Smile size={20} /> },
  { text: 'AI Powered', color: 'pink', icon: <Sparkles size={20} /> },
  { text: 'Fun & Easy', color: 'green', icon: <Star size={20} /> },
  { text: 'Personalized', color: 'blue2', icon: <User size={20} /> },
];

const shouldShowIntro = () => {
  if (typeof document === 'undefined') return true;
  const ref = document.referrer;
  console.log('[IntroBubbles] Referrer:', String(ref).slice(0, 200));
  // If referrer is internal and skip-intro flag is set, skip intro
  if (ref) {
    try {
      const refUrl = new URL(ref);
      console.log('[IntroBubbles] Referrer hostname:', refUrl.hostname, 'Current hostname:', window.location.hostname);
      if (refUrl.hostname === window.location.hostname && window.sessionStorage.getItem('fitbuddyai-skip-intro') === '1') {
        console.log('[IntroBubbles] Skipping intro due to sessionStorage flag.');
        return false;
      }
    } catch (e) {
      console.log('[IntroBubbles] Referrer parse error:', e);
      // ignore parse error, treat as external
    }
  }
  // Otherwise, show intro (external referrer or direct visit)
  console.log('[IntroBubbles] Showing intro.');
  return true;
};

const IntroBubbles: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [shouldShow, setShouldShow] = useState<null | boolean>(null);
  const [phase, setPhase] = useState<'wait' | 'flyin' | 'meet' | 'orbit' | 'fadeout'>('wait');
  const [hide, setHide] = useState(false);
  const [visibleBubbles, setVisibleBubbles] = useState(0);

  useEffect(() => {
    const show = shouldShowIntro();
    console.log('[IntroBubbles] useEffect: shouldShowIntro() =', show);
    setShouldShow(show);
  }, []);
  // Store random seeds in a ref so they persist across renders but are not global
  const randomSeeds = useRef<{ angle: number[]; dist: number[]; edge: number[]; edgePos: number[] }>();
  if (!randomSeeds.current) {
    randomSeeds.current = {
      angle: Array.from({ length: bubblesData.length }, () => Math.random() * 30 - 15), // -15 to +15 deg
      dist: Array.from({ length: bubblesData.length }, () => Math.random() * 30 - 15), // -15 to +15 px
      edge: Array.from({ length: bubblesData.length }, () => Math.floor(Math.random() * 4)), // 0=top,1=right,2=bottom,3=left
      edgePos: Array.from({ length: bubblesData.length }, () => Math.random() * 100), // 0-100vw/vh
    };
    try {
      const small = JSON.stringify(randomSeeds.current).slice(0, 400);
      console.log('[IntroBubbles] Random seeds generated:', small);
    } catch {
      console.log('[IntroBubbles] Random seeds generated');
    }
  }

  // Use a ref for onFinish to avoid effect restarts
  const onFinishRef = useRef(onFinish);
  useEffect(() => { onFinishRef.current = onFinish; }, [onFinish]);

  // Generate per-bubble CSS rules to avoid inline styles (creates a <style> tag)
  const dynamicStylesId = 'intro-bubbles-dynamic-styles';
  useEffect(() => {
    try {
      const existing = document.getElementById(dynamicStylesId) as HTMLStyleElement | null;
      let styleEl = existing;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = dynamicStylesId;
        document.head.appendChild(styleEl);
      }
      // Build CSS rules for each bubble based on random seeds
      const parts: string[] = [];
      for (let i = 0; i < bubblesData.length; i++) {
        const edge = randomSeeds.current!.edge[i];
        const edgePos = randomSeeds.current!.edgePos[i];
        let offX = 0, offY = 0;
        if (edge === 0) { // top
          offX = edgePos;
          offY = -10;
        } else if (edge === 1) { // right
          offX = 110;
          offY = edgePos;
        } else if (edge === 2) { // bottom
          offX = edgePos;
          offY = 110;
        } else { // left
          offX = -10;
          offY = edgePos;
        }
        const angle = (360 / bubblesData.length) * i;
        const distance = 210;
        parts.push(`.intro-bubble-pos-${i} { --offscreen-x: ${offX}px; --offscreen-y: ${offY}px; --angle: ${angle}deg; --distance: ${distance}px; }`);
      }
      styleEl.innerHTML = parts.join('\n');
      return () => {
        try { if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl); } catch (e) {}
      };
    } catch (e) {
      // ignore in non-browser environments
    }
  }, []);

  useEffect(() => {
    if (shouldShow === null) return;
    if (!shouldShow) {
      console.log('[IntroBubbles] Skipping intro, calling onFinish immediately.');
      onFinishRef.current();
      return;
    }
    const timers: any[] = [];
    console.log('[IntroBubbles] Starting intro animation.');
    setPhase('flyin');
    setVisibleBubbles(0); // Always start from 0
    // Show bubbles one by one every 400ms
    for (let i = 0; i < bubblesData.length; i++) {
      timers.push(setTimeout(() => {
        setVisibleBubbles(v => v + 1);
        console.log(`[IntroBubbles] Bubble ${i} now visible.`);
      }, i * 400));
    }
    // After all bubbles are visible, wait, then join to logo
    const totalFlyIn = bubblesData.length * 400 + 800;
    timers.push(setTimeout(() => {
      setPhase('meet');
      console.log('[IntroBubbles] Phase changed: meet');
    }, totalFlyIn));
    timers.push(setTimeout(() => {
      setPhase('orbit');
      console.log('[IntroBubbles] Phase changed: orbit');
    }, totalFlyIn + 1000));
    timers.push(setTimeout(() => {
      setPhase('fadeout');
      console.log('[IntroBubbles] Phase changed: fadeout');
    }, totalFlyIn + 4000));
    // Finish after fade-out to avoid flashing content underneath
    timers.push(setTimeout(() => {
      console.log('[IntroBubbles] onFinish called after fadeout. Hiding overlay.');
      setHide(true);
      onFinishRef.current();
    }, totalFlyIn + 4800));
    return () => {
      timers.forEach(clearTimeout);
      console.log('[IntroBubbles] Cleaned up timers.');
    };
  }, [shouldShow]);

  if (shouldShow === null) return null;
  if (!shouldShow) return null;
  console.log('[IntroBubbles] Rendering. Phase:', phase, 'Hide:', hide, 'VisibleBubbles:', visibleBubbles);
  return (
    <div className={`intro-bubbles-overlay${hide ? ' hide' : ''} ${phase === 'fadeout' ? 'fade-white fade-out' : ''}`}> 
      <div className="bubbles-centerpiece">
        <div className="center-logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-dumbbell"><path d="m6.5 6.5 11 11"></path><path d="m21 21-1-1"></path><path d="m3 3 1 1"></path><path d="m18 22 4-4"></path><path d="m2 6 4-4"></path><path d="m3 10 7-7"></path><path d="m14 21 7-7"></path></svg>
        </div>
        <div className={phase === 'orbit' ? 'bubbles-rotate' : ''}>
          {/* Add randomness to angle and distance for each bubble */}
          {bubblesData.map((bubble, i) => {
            // Only show visible bubbles
            if (i >= visibleBubbles) return null;
            // Calculate offscreen position for each bubble
            const edge = randomSeeds.current!.edge[i];
            const edgePos = randomSeeds.current!.edgePos[i];
            let offX = 0, offY = 0;
            if (edge === 0) { // top
              offX = edgePos;
              offY = -10;
            } else if (edge === 1) { // right
              offX = 110;
              offY = edgePos;
            } else if (edge === 2) { // bottom
              offX = edgePos;
              offY = 110;
            } else { // left
              offX = -10;
              offY = edgePos;
            }
            const angle = (360 / bubblesData.length) * i;
            const distance = 210;
            let bubbleClass = `bubble bubble-color-${bubble.color}`;
            if (phase === 'flyin') bubbleClass += ' bubble-fly-in';
            if (phase === 'orbit') bubbleClass += ' bubble-orbit';
            if (phase === 'meet') bubbleClass += ' bubble-meet';
            try {
              const summary = JSON.stringify({ i, phase, bubbleClass, offX, offY, angle, distance }).slice(0, 300);
              console.log(`[IntroBubbles] Rendering bubble ${i}:`, summary);
            } catch {
              console.log(`[IntroBubbles] Rendering bubble ${i}`);
            }
            return (
              <div
                key={i}
                className={`${bubbleClass} intro-bubble-pos-${i}`}
              >
                <span className="bubble-icon">{bubble.icon}</span>
                {bubble.text}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default IntroBubbles;
