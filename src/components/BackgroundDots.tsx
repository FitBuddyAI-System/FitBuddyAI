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
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Fade canvas in after mount so it's always visible behind the UI
    const readyTimer = window.setTimeout(() => setIsReady(true), 20);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = !prefersReduced;
    const dotCount = isMobile ? 450 : 1600;

    const computeHeight = () => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollH = Math.max(
        window.innerHeight,
        doc?.scrollHeight || 0,
        body?.scrollHeight || 0,
        doc?.clientHeight || 0,
        body?.clientHeight || 0,
        canvas.parentElement?.scrollHeight || 0
      );
      return scrollH || window.innerHeight;
    };

    let width = window.innerWidth;
    let height = computeHeight();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    type Dot = { x: number; y: number; baseX: number; baseY: number; r: number; jitter: number };
    const dots: Dot[] = Array.from({ length: dotCount }).map(() => ({
      baseX: Math.random() * width,
      baseY: Math.random() * height,
      x: 0,
      y: 0,
      r: Math.random() * 1.4 + 0.75, // slightly larger for better visibility
      jitter: (Math.random() - 0.5) * 0.25,
    })).map(d => ({ ...d, x: d.baseX, y: d.baseY }));

    const influence = isMobile ? 70 : 120;
    const pullBack = animate ? 0.045 : 0.06;
    const repulseStrength = animate ? 0.14 : 0.0;

    const draw = (oneShot = false) => {
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      for (const d of dots) {
        if (animate) {
          // Tiny drift
          d.x += d.jitter;
          d.y += d.jitter * 0.6;
          // Keep drift bounded
          if (Math.abs(d.x - d.baseX) > 10) d.jitter *= -1;
          if (Math.abs(d.y - d.baseY) > 10) d.jitter *= -1;
        }

        if (mouseRef.current.active && animate) {
          const dx = d.x - mouseRef.current.x;
          const dy = d.y - mouseRef.current.y;
          const dist = Math.hypot(dx, dy);
          if (dist < influence && dist > 0.01) {
            const force = (influence - dist) / influence;
            d.x += (dx / dist) * force * influence * repulseStrength;
            d.y += (dy / dist) * force * influence * repulseStrength;
          }
        }
        // Ease back toward origin
        d.x += (d.baseX - d.x) * pullBack;
        d.y += (d.baseY - d.y) * pullBack;

        ctx.moveTo(d.x + d.r, d.y);
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      }
      // Brighter, slightly more opaque dots for better visibility
      ctx.fillStyle = 'rgba(30, 200, 130, 0.38)';
      ctx.fill();
      if (!oneShot) rafRef.current = requestAnimationFrame(loop);
    };

    // FrameRequestCallback-compatible wrapper that forwards to our draw() function.
    const loop = (_timestamp: number) => {
      // Always run a regular frame (oneShot=false) when scheduled by rAF.
      draw(false);
    };

    const handleMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const handleLeave = () => {
      mouseRef.current.active = false;
    };
    const handleResize = () => {
      const newWidth = window.innerWidth;
      const newHeight = computeHeight();
      const scaleX = newWidth / width;
      const scaleY = newHeight / height;
      width = newWidth;
      height = newHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      // Scale dots to fit the new canvas size so coverage remains full-height
      for (const d of dots) {
        d.baseX *= scaleX;
        d.baseY *= scaleY;
        d.x = d.baseX;
        d.y = d.baseY;
      }
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseleave', handleLeave);
    window.addEventListener('resize', handleResize);
    if (animate) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      draw(true); // render once for reduced motion users
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseleave', handleLeave);
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.clearTimeout(readyTimer);
    };
  }, []);

  return <canvas ref={canvasRef} className={`dots-canvas${isReady ? ' dots-ready' : ''}`} aria-hidden="true" />;
};

export default BackgroundDots;
