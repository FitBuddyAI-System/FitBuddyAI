// Tiny DOM-based confetti helper — no external deps
export function burstConfetti(opts: {count?: number, gravity?: number} = {}) {
  const count = opts.count || 30;
  const gravity = opts.gravity || 0.6;
  const colors = ['#1ecb7b','#1e90cb','#ffb347','#ffd54a','#7bd389'];
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '100%';
  container.style.height = '0';
  container.style.pointerEvents = 'none';
  container.style.overflow = 'visible';
  container.style.zIndex = '9999';
  document.body.appendChild(container);

  for (let i=0;i<count;i++) {
    const el = document.createElement('div');
    const size = 6 + Math.random()*10;
    el.style.position = 'absolute';
    el.style.left = (50 + (Math.random()-0.5)*60) + '%';
    el.style.top = '-10px';
    el.style.width = size + 'px';
    el.style.height = (size*0.6) + 'px';
    el.style.background = colors[Math.floor(Math.random()*colors.length)];
    el.style.opacity = '0.95';
    el.style.transform = 'rotate(' + (Math.random()*360) + 'deg)';
    el.style.borderRadius = (Math.random()*3) + 'px';
    el.style.willChange = 'transform, top, opacity';
    container.appendChild(el);

    // animate via requestAnimationFrame
    const vx = (Math.random()-0.5) * 6;
    let vy = 2 + Math.random()*4;
    let x = (window.innerWidth * 0.5) + (Math.random()-0.5) * window.innerWidth * 0.6;
    let y = -20 - Math.random()*50;
    const rotateSpeed = (Math.random()-0.5) * 10;

    function frame() {
      vy += gravity * 0.05;
      x += vx;
      y += vy;
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      const r = (parseFloat(el.style.transform.replace('rotate(','').replace('deg)','')) || 0) + rotateSpeed;
      el.style.transform = 'rotate(' + r + 'deg)';
      el.style.opacity = String(Math.max(0, 1 - y / (window.innerHeight * 0.9)));
      if (y < window.innerHeight + 100) requestAnimationFrame(frame);
      else el.remove();
    }
    requestAnimationFrame(frame);
  }

  // cleanup container after some time
  setTimeout(() => container.remove(), 5000);
}
