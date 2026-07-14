/* =========================================
   DARAPET TECHNOLOGY — Animated Background Injector
   Runs on every page — creates deep blue animated bg
   ========================================= */
(function () {
  'use strict';

  /* ---- 1. Create fixed #site-bg container ---- */
  const siteBg = document.createElement('div');
  siteBg.id = 'site-bg';

  /* Aurora sweep layer */
  const aurora = document.createElement('div');
  aurora.className = 'bg-aurora';
  siteBg.appendChild(aurora);

  /* Floating orbs — 5 layers */
  for (let i = 1; i <= 5; i++) {
    const orb = document.createElement('div');
    orb.className = `bg-orb bg-orb--${i}`;
    siteBg.appendChild(orb);
  }

  /* Particle container */
  const particleWrap = document.createElement('div');
  particleWrap.className = 'bg-particles';

  /* Generate 30 tiny floating dots */
  const colors = [
    'rgba(96,165,250,ALPHA)',
    'rgba(147,197,253,ALPHA)',
    'rgba(186,230,253,ALPHA)',
    'rgba(59,130,246,ALPHA)',
    'rgba(14,165,233,ALPHA)',
  ];

  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'bg-particle';
    const size = Math.random() * 3 + 1; // 1–4px
    const alpha = (Math.random() * 0.4 + 0.2).toFixed(2);
    const color = colors[Math.floor(Math.random() * colors.length)].replace('ALPHA', alpha);
    const dur = (Math.random() * 15 + 10).toFixed(1); // 10–25s
    const delay = (Math.random() * -20).toFixed(1);    // stagger
    const drift = (Math.random() * 80 - 40).toFixed(0) + 'px';
    const op = (Math.random() * 0.3 + 0.15).toFixed(2);
    const left = (Math.random() * 100).toFixed(1) + '%';
    const top = (Math.random() * 100).toFixed(1) + '%';

    p.style.cssText = `
      width:${size}px;
      height:${size}px;
      background:${color};
      left:${left};
      top:${top};
      --dur:${dur}s;
      --delay:${delay}s;
      --drift:${drift};
      --op:${op};
      animation-delay:${delay}s;
    `;
    particleWrap.appendChild(p);
  }
  siteBg.appendChild(particleWrap);

  /* Insert as first child of body */
  document.body.insertBefore(siteBg, document.body.firstChild);

  /* ---- 2. Subtle parallax on orbs on mouse move ---- */
  let ticking = false;
  document.addEventListener('mousemove', function (e) {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      const xRatio = (e.clientX / window.innerWidth - 0.5);
      const yRatio = (e.clientY / window.innerHeight - 0.5);

      const orbs = siteBg.querySelectorAll('.bg-orb');
      const factors = [18, 12, 8, 22, 15];
      orbs.forEach(function (orb, idx) {
        const f = factors[idx] || 10;
        orb.style.transform =
          `translate(${xRatio * f}px, ${yRatio * f}px)`;
      });
      ticking = false;
    });
  });

  /* ---- 3. Scroll-based depth shift ---- */
  window.addEventListener('scroll', function () {
    const scrolled = window.scrollY;
    const orb1 = siteBg.querySelector('.bg-orb--1');
    const orb3 = siteBg.querySelector('.bg-orb--3');
    if (orb1) orb1.style.marginTop = (scrolled * 0.12) + 'px';
    if (orb3) orb3.style.marginTop = (-scrolled * 0.08) + 'px';
  }, { passive: true });

})();
