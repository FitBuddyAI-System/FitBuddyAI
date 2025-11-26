import React, { useEffect, useRef, useState } from 'react';
import './BackgroundDots.css';

/**
 * Background canvas of tiny dots that gently react to the cursor.
 * Optimized to keep draw calls light and avoid layout reflows.
 */
const BackgroundDots: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const mouseRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const [ready, setReady] = useState(false);
  const paletteRef = useRef<{
    baseFill: string;
    gradientStops: [string, string];
    line: { r: number; g: number; b: number; alpha: number };
  }>({
    baseFill: 'rgba(247, 247, 247, 0.9)',
    gradientStops: ['rgba(46, 204, 113, 0.5)', 'rgba(28, 176, 246, 0.5)'],
    line: { r: 30, g: 170, b: 200, alpha: 0.5 }
  });

  useEffect(() => {
    const readyFrame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(readyFrame);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motionFactor = prefersReduced ? 0.4 : 1;
    const animate = true; // force motion even if reduced-motion is on (scaled down by motionFactor)
    const enableInteractivity = false; // disable all cursor-based interaction
    const dotCount = isMobile ? 450 : 1600;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    type Dot = { x: number; y: number; baseX: number; baseY: number; r: number; vx: number; vy: number };
    let fillGradient = ctx.createLinearGradient(0, 0, width, height);

    const updatePalette = () => {
      const isDark =
        document.body.classList.contains('theme-dark') ||
        document.documentElement.classList.contains('theme-dark');
      paletteRef.current = isDark
        ? {
            baseFill: 'rgba(10, 15, 25, 1)',
            gradientStops: ['rgba(46, 204, 113, 0.5)', 'rgba(28, 176, 246, 0.5)'],
            line: { r: 30, g: 170, b: 200, alpha: 0.5 }
          }
        : {
            baseFill: 'rgba(255, 255, 255, 1)',
            gradientStops: ['rgba(88, 204, 2, 0.3)', 'rgba(46, 170, 100, 0.225)'], // 50% more transparent
            line: { r: 88, g: 204, b: 2, alpha: 0.25 } // 50% more transparent
          };
      fillGradient = ctx.createLinearGradient(0, 0, width, height);
      fillGradient.addColorStop(0, paletteRef.current.gradientStops[0]);
      fillGradient.addColorStop(1, paletteRef.current.gradientStops[1]);
    };
    updatePalette();

    const observer = new MutationObserver(() => {
      updatePalette();
      // Force an immediate repaint so theme changes are visible without refresh
      draw(true);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    const dots: Dot[] = Array.from({ length: dotCount }).map(() => ({
      baseX: Math.random() * width,
      baseY: Math.random() * height,
      x: 0,
      y: 0,
      r: Math.random() * 1.2 + 1.0, // larger for visibility
      vx: (Math.random() - 0.5) * 1.2 * motionFactor,
      vy: (Math.random() - 0.5) * 1.2 * motionFactor,
    })).map(d => ({ ...d, x: d.baseX, y: d.baseY }));

    const influence = isMobile ? 160 : 240; // radius for cursor interaction
    const pullBack = animate ? 0.1 * motionFactor : 0.1 * motionFactor;
    const repulseStrength = enableInteractivity && animate ? 0.28 * motionFactor : 0.0; // no push when disabled
    // Larger threshold yields a denser web of lines
    const lineThreshold = isMobile ? 120 : 180;
    const cellSize = lineThreshold;

    const draw = (oneShot = false) => {
      // Paint a consistent base color so dots are always visible
      ctx.fillStyle = paletteRef.current.baseFill;
      ctx.fillRect(0, 0, width, height);
      ctx.beginPath();
      for (const d of dots) {
        if (animate) {
          // Small random acceleration for continuous motion
          d.vx += (Math.random() - 0.5) * 0.12 * motionFactor;
          d.vy += (Math.random() - 0.5) * 0.12 * motionFactor;
          // Damping to keep speeds moderate
          d.vx *= 0.985;
          d.vy *= 0.985;
          // If we get too slow, re-seed a tiny nudge to keep visible motion
          if (Math.abs(d.vx) + Math.abs(d.vy) < 0.02) {
            d.vx += (Math.random() - 0.5) * 0.4 * motionFactor;
            d.vy += (Math.random() - 0.5) * 0.4 * motionFactor;
          }
        }

        if (enableInteractivity && mouseRef.current.active && animate) {
          const dx = d.x - mouseRef.current.x;
          const dy = d.y - mouseRef.current.y;
          const dist = Math.hypot(dx, dy);
          if (dist < influence && dist > 0.01) {
            const force = (influence - dist) / influence;
            const basePush = (dx / dist) * force * influence * repulseStrength;
            const basePushY = (dy / dist) * force * influence * repulseStrength;
            // amplify when very close to the cursor
            const boost = dist < influence * 0.35 ? 1.25 : 1;
            d.vx += basePush * boost;
            d.vy += basePushY * boost;
          }
        }
        // Ease back toward origin
        d.vx += (d.baseX - d.x) * pullBack;
        d.vy += (d.baseY - d.y) * pullBack;

        d.x += d.vx;
        d.y += d.vy;

        ctx.moveTo(d.x + d.r, d.y);
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      }
      ctx.fillStyle = fillGradient;
      ctx.fill();

      // Build a lightweight spatial grid for connections
      const grid = new Map<string, number[]>();
      dots.forEach((d, idx) => {
        const key = `${Math.floor(d.x / cellSize)}:${Math.floor(d.y / cellSize)}`;
        const bucket = grid.get(key);
        if (bucket) bucket.push(idx);
        else grid.set(key, [idx]);
      });

      ctx.beginPath();
      const line = paletteRef.current.line;
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const cx = Math.floor(d.x / cellSize);
        const cy = Math.floor(d.y / cellSize);
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const key = `${cx + dx}:${cy + dy}`;
            const bucket = grid.get(key);
            if (!bucket) continue;
            for (const j of bucket) {
              if (j <= i) continue;
              const d2 = dots[j];
              const dist = Math.hypot(d.x - d2.x, d.y - d2.y);
              if (dist < lineThreshold && ((i + j) % 35) < 1) { // keep ~3% of potential lines
                const alpha = Math.max(0.22, 1 - dist / lineThreshold);
                ctx.strokeStyle = `rgba(${line.r}, ${line.g}, ${line.b}, ${line.alpha * alpha})`;
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d2.x, d2.y);
              }
            }
          }
        }
      }
      ctx.lineWidth = 0.9;
      ctx.stroke();

      if (!oneShot) rafRef.current = requestAnimationFrame(draw);
    };

    const handleMove = (e: MouseEvent) => {
      if (!enableInteractivity) return;
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const handleLeave = () => {
      if (!enableInteractivity) return;
      mouseRef.current.active = false;
    };
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      updatePalette();
    };

    if (enableInteractivity) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseleave', handleLeave);
    }
    window.addEventListener('resize', handleResize);
    if (animate) {
      rafRef.current = requestAnimationFrame(draw);
    } else {
      draw(true); // render once for reduced motion users
    }

    return () => {
      if (enableInteractivity) {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseleave', handleLeave);
      }
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={`dots-canvas ${ready ? 'dots-ready' : ''}`} aria-hidden="true" />;
};

export default BackgroundDots;
