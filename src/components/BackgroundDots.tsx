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
    const readyTimer = window.setTimeout(() => setIsReady(true), 20);
    const canvas = canvasRef.current;
    if (!canvas) {
      return () => window.clearTimeout(readyTimer);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      window.clearTimeout(readyTimer);
      return () => {};
    }

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const animate = !prefersReduced;
    const dotCount = isMobile ? 450 : 900;

    const computeDimensions = () => {
      const parent = canvas.parentElement;
      const parentClientWidth = parent?.clientWidth || 0;
      const parentScrollWidth = parent?.scrollWidth || 0;
      const parentClientHeight = parent?.clientHeight || 0;
      const parentScrollHeight = parent?.scrollHeight || 0;
      const width = Math.max(parentClientWidth, parentScrollWidth, window.innerWidth);
      const height = Math.max(parentClientHeight, parentScrollHeight, window.innerHeight);
      return { width, height };
    };

    let { width, height } = computeDimensions();
    const dpr = window.devicePixelRatio || 1;

    const setCanvasSize = () => {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    setCanvasSize();

    type Dot = { x: number; y: number; baseX: number; baseY: number; r: number; jitter: number };
    const dots: Dot[] = Array.from({ length: dotCount }).map(() => ({
      baseX: Math.random() * width,
      baseY: Math.random() * height,
      x: 0,
      y: 0,
      r: Math.random() * 1.4 + 0.75,
      jitter: (Math.random() - 0.5) * 0.25,
    })).map(d => ({ ...d, x: d.baseX, y: d.baseY }));

    const influence = isMobile ? 70 : 120;
    const pullBack = animate ? 0.045 : 0.06;
    const repulseStrength = animate ? 0.14 : 0.0;

    let isCanvasVisible = true;
    let pageVisible = document.visibilityState !== 'hidden';
    const shouldAnimate = () => animate && isCanvasVisible && pageVisible;

    const draw = (oneShot = false) => {
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      for (const d of dots) {
        if (animate) {
          d.x += d.jitter;
          d.y += d.jitter * 0.6;
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
        d.x += (d.baseX - d.x) * pullBack;
        d.y += (d.baseY - d.y) * pullBack;
        ctx.moveTo(d.x + d.r, d.y);
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      }
      ctx.fillStyle = 'rgba(30, 200, 130, 0.38)';
      ctx.fill();
      if (oneShot) return;
    };

    const frame = () => {
      rafRef.current = null;
      if (!shouldAnimate()) return;
      draw(false);
      scheduleFrame();
    };

    const scheduleFrame = () => {
      if (!shouldAnimate() || rafRef.current) return;
      rafRef.current = requestAnimationFrame(frame);
    };

    const cancelFrame = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const toggleAnimation = () => {
      if (shouldAnimate()) scheduleFrame();
      else cancelFrame();
    };

    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver(entries => {
        if (!entries.length) return;
        const entry = entries[0];
        const visibleNow = entry.isIntersecting && entry.intersectionRatio > 0;
        if (visibleNow !== isCanvasVisible) {
          isCanvasVisible = visibleNow;
          toggleAnimation();
        }
      }, { threshold: 0.05 });
      observer.observe(canvas);
    } catch (err) {
      // Fallback: treat canvas as visible when IntersectionObserver isn't available
      observer = null;
    }

    const handleVisibilityChange = () => {
      const nowVisible = document.visibilityState !== 'hidden';
      if (nowVisible !== pageVisible) {
        pageVisible = nowVisible;
        toggleAnimation();
      }
    };

    let lastMoveTimestamp = 0;
    const handleMove = (e: MouseEvent) => {
      const now = performance.now();
      if (now - lastMoveTimestamp < 20) return;
      lastMoveTimestamp = now;
      const scrollX = window.scrollX ?? document.documentElement.scrollLeft;
      const scrollY = window.scrollY ?? document.documentElement.scrollTop;
      const pageX = e.pageX ?? e.clientX + scrollX;
      const pageY = e.pageY ?? e.clientY + scrollY;
      mouseRef.current = { x: pageX, y: pageY, active: true };
    };

    const handleLeave = () => {
      mouseRef.current.active = false;
    };

    const handleResize = () => {
      const dims = computeDimensions();
      const newWidth = dims.width;
      const newHeight = dims.height;
      const scaleX = newWidth / width;
      const scaleY = newHeight / height;
      width = newWidth;
      height = newHeight;
      setCanvasSize();
      for (const d of dots) {
        d.baseX *= scaleX;
        d.baseY *= scaleY;
        d.x = d.baseX;
        d.y = d.baseY;
      }
      draw(true);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseleave', handleLeave);
    window.addEventListener('resize', handleResize);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    draw(true);
    if (animate) toggleAnimation();

    return () => {
      cancelFrame();
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseleave', handleLeave);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      if (observer) {
        try { observer.disconnect(); } catch {}
      }
      window.clearTimeout(readyTimer);
    };
  }, []);

  return <canvas ref={canvasRef} className={`dots-canvas${isReady ? ' dots-ready' : ''}`} aria-hidden="true" />;
};

export default BackgroundDots;
