/* =========================================
   DARAPET TECHNOLOGY — MAIN JS
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {

  /* ---- TYPEWRITER EFFECT ---- */
  const phrases = [
    'Web & App Development',
    'Video Editing & Motion',
    'Graphics & Brand Design',
    'Digital & Email Marketing',
    'Engineering Ideas. Empowering Independence.'
  ];
  let phraseIdx = 0, charIdx = 0, isDeleting = false;
  const el = document.getElementById('typewriterText');
  function typeWriter() {
    if (!el) return;
    const current = phrases[phraseIdx];
    el.textContent = isDeleting
      ? current.substring(0, charIdx--)
      : current.substring(0, charIdx++);
    let delay = isDeleting ? 40 : 80;
    if (!isDeleting && charIdx === current.length + 1) {
      isDeleting = true; delay = 1800;
    } else if (isDeleting && charIdx === 0) {
      isDeleting = false;
      phraseIdx = (phraseIdx + 1) % phrases.length;
      delay = 400;
    }
    setTimeout(typeWriter, delay);
  }
  setTimeout(typeWriter, 800);

  /* ---- HERO HEADLINE TYPING ---- */
  const heroTypedEl = document.getElementById('heroTyped');
  if (heroTypedEl) {
    const heroWords = ['Independence.', 'Innovation.', 'Excellence.', 'Growth.', 'Impact.'];
    let hIdx = 0, hChar = 0, hDeleting = false;
    function typeHero() {
      const word = heroWords[hIdx];
      heroTypedEl.textContent = hDeleting
        ? word.substring(0, hChar--)
        : word.substring(0, hChar++);
      let delay = hDeleting ? 55 : 105;
      if (!hDeleting && hChar === word.length + 1) {
        hDeleting = true; delay = 2600;
      } else if (hDeleting && hChar === 0) {
        hDeleting = false;
        hIdx = (hIdx + 1) % heroWords.length;
        delay = 480;
      }
      setTimeout(typeHero, delay);
    }
    // Start after the word-reveal animation settles (~1.5s)
    setTimeout(typeHero, 1500);
  }

  /* ---- SERVICE TYPING (below hero sub) ---- */
  const serviceTypedEl = document.getElementById('serviceTyped');
  if (serviceTypedEl) {
    const services = [
      'an E-Commerce Store',
      'a Brand Identity System',
      'a Motion Graphic Reel',
      'a Marketing Campaign',
      'a SaaS Dashboard',
      'a Full-Stack Web App',
    ];
    let sIdx = 0, sChar = 0, sDeleting = false;
    function typeService() {
      const s = services[sIdx];
      serviceTypedEl.textContent = sDeleting
        ? s.substring(0, sChar--)
        : s.substring(0, sChar++);
      let delay = sDeleting ? 38 : 78;
      if (!sDeleting && sChar === s.length + 1) {
        sDeleting = true; delay = 2200;
      } else if (sDeleting && sChar === 0) {
        sDeleting = false;
        sIdx = (sIdx + 1) % services.length;
        delay = 320;
      }
      setTimeout(typeService, delay);
    }
    setTimeout(typeService, 2000);
  }

  /* ---- HEADER SCROLL ---- */
  const header = document.getElementById('mainHeader');
  function handleScroll() {
    if (!header) return;
    header.classList.toggle('scrolled', window.scrollY > 20);
  }
  window.addEventListener('scroll', handleScroll, { passive: true });

  /* ---- MOBILE DRAWER ---- */
  const hamburger = document.getElementById('hamburger');
  const drawer = document.getElementById('mobileDrawer');
  const drawerClose = document.getElementById('drawerClose');
  const overlay = document.getElementById('overlay');
  function openDrawer() {
    drawer && drawer.classList.add('open');
    overlay && overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    drawer && drawer.classList.remove('open');
    overlay && overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
  hamburger && hamburger.addEventListener('click', openDrawer);
  drawerClose && drawerClose.addEventListener('click', closeDrawer);
  overlay && overlay.addEventListener('click', closeDrawer);

  /* ---- SCROLL REVEAL ---- */
  const reveals = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach(el => revealObserver.observe(el));

  /* ---- COUNT UP ---- */
  function animateCount(el) {
    const target = parseInt(el.dataset.target, 10);
    const duration = 1800;
    const step = target / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = Math.floor(current);
      if (current >= target) clearInterval(timer);
    }, 16);
  }
  const counters = document.querySelectorAll('.count, .big-count');
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !entry.target.dataset.animated) {
        entry.target.dataset.animated = 'true';
        animateCount(entry.target);
        countObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  counters.forEach(c => countObserver.observe(c));

  /* ---- TESTIMONIAL SLIDER ---- */
  const track = document.getElementById('testimonialsTrack');
  const dotsContainer = document.getElementById('sliderDots');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  if (track) {
    const cards = track.querySelectorAll('.testimonial-card');
    let current = 0;
    const visible = () => window.innerWidth <= 768 ? 1 : window.innerWidth <= 1024 ? 2 : 3;
    const maxIdx = () => Math.max(0, cards.length - visible());

    function buildDots() {
      if (!dotsContainer) return;
      dotsContainer.innerHTML = '';
      const total = maxIdx() + 1;
      for (let i = 0; i < total; i++) {
        const d = document.createElement('div');
        d.className = 'dot' + (i === current ? ' active' : '');
        d.addEventListener('click', () => goTo(i));
        dotsContainer.appendChild(d);
      }
    }
    function updateDots() {
      if (!dotsContainer) return;
      dotsContainer.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === current));
    }
    function goTo(idx) {
      current = Math.max(0, Math.min(idx, maxIdx()));
      const cardW = cards[0].offsetWidth + 24;
      track.style.transform = `translateX(-${current * cardW}px)`;
      updateDots();
    }
    prevBtn && prevBtn.addEventListener('click', () => goTo(current - 1));
    nextBtn && nextBtn.addEventListener('click', () => goTo(current + 1));
    buildDots();
    window.addEventListener('resize', () => { buildDots(); goTo(Math.min(current, maxIdx())); });

    // Auto-play
    let autoSlide = setInterval(() => goTo(current < maxIdx() ? current + 1 : 0), 5000);
    track.addEventListener('mouseenter', () => clearInterval(autoSlide));
    track.addEventListener('mouseleave', () => { autoSlide = setInterval(() => goTo(current < maxIdx() ? current + 1 : 0), 5000); });
  }

  /* ---- DUPLICATE MARQUEE ---- */
  const marquee = document.getElementById('marqueeInner');
  if (marquee) {
    marquee.innerHTML += marquee.innerHTML;
  }

  /* ---- FAQ ACCORDION ---- */
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });

  /* ---- PORTFOLIO FILTER ---- */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('.portfolio-card').forEach(card => {
        if (filter === 'all' || card.dataset.category === filter) {
          card.style.display = '';
          setTimeout(() => card.style.opacity = 1, 10);
        } else {
          card.style.opacity = 0;
          setTimeout(() => card.style.display = 'none', 300);
        }
      });
    });
  });

  /* ---- CONTACT FORM ---- */
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = contactForm.querySelector('[type=submit]');
      btn.innerHTML = '<span class="spinner"></span> Sending...';
      btn.disabled = true;
      setTimeout(() => {
        btn.innerHTML = '<i class="fas fa-check"></i> Message Sent!';
        btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
        contactForm.reset();
        setTimeout(() => {
          btn.innerHTML = 'Send Message <i class="fas fa-paper-plane"></i>';
          btn.style.background = '';
          btn.disabled = false;
        }, 3000);
      }, 1500);
    });
  }

  /* ---- ADMIN NAV TABS ---- */
  document.querySelectorAll('.admin-nav a[data-section]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.section;
      document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      link.classList.add('active');
      const section = document.getElementById(target);
      if (section) section.classList.add('active');
    });
  });

  /* ---- ADMIN SOCIAL SAVE ---- */
  const socialForm = document.getElementById('socialSettingsForm');
  if (socialForm) {
    // Load saved values
    const fields = ['facebook','twitter','instagram','tiktok','linkedin','fiverr','upwork'];
    fields.forEach(f => {
      const input = document.getElementById('admin-' + f);
      if (input) input.value = localStorage.getItem('dt_social_' + f) || '';
    });
    socialForm.addEventListener('submit', (e) => {
      e.preventDefault();
      fields.forEach(f => {
        const input = document.getElementById('admin-' + f);
        if (input) localStorage.setItem('dt_social_' + f, input.value.trim());
      });
      applySocials();
      const btn = socialForm.querySelector('[type=submit]');
      const orig = btn.textContent;
      btn.textContent = '✓ Saved!';
      btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
      setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 2000);
    });
  }

  /* ---- NEWSLETTER FORM ---- */
  document.querySelectorAll('.newsletter').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = form.querySelector('input');
      const btn = form.querySelector('button');
      if (input && input.value) {
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
        input.value = '';
        setTimeout(() => {
          btn.innerHTML = '<i class="fas fa-paper-plane"></i>';
          btn.style.background = '';
        }, 2500);
      }
    });
  });
  document.querySelectorAll('.newsletter').forEach(n => {
    n.addEventListener('keydown', e => { if(e.key==='Enter') n.dispatchEvent(new Event('submit')); });
  });

  /* ---- PAGE FADE IN ---- */
  document.body.classList.add('page-fade-in');

  /* ---- HERO WELCOME (multilingual greeting typer) ---- */
  const welcomeEl = document.getElementById('heroWelcomeText');
  if (welcomeEl) {
    const greetings = ['Welcome', 'Bienvenue', 'Bienvenido', 'Willkommen', 'Karibu', 'Ẹ ku abọ', 'ようこそ', 'Benvenuto'];
    let wIdx = 0, wChar = 0, wDeleting = false;
    function typeWelcome() {
      const word = greetings[wIdx];
      welcomeEl.textContent = wDeleting
        ? word.substring(0, wChar--)
        : word.substring(0, wChar++);
      let delay = wDeleting ? 45 : 90;
      if (!wDeleting && wChar === word.length + 1) {
        wDeleting = true; delay = 1400;
      } else if (wDeleting && wChar === 0) {
        wDeleting = false;
        wIdx = (wIdx + 1) % greetings.length;
        delay = 300;
      }
      setTimeout(typeWelcome, delay);
    }
    setTimeout(typeWelcome, 400);
  }

  /* ---- CLICK-TO-PLAY YOUTUBE PORTFOLIO CARDS ---- */
  document.querySelectorAll('.video-portfolio-card[data-yt]').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.yt;
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
      iframe.title = 'Video portfolio piece';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      card.innerHTML = '';
      card.appendChild(iframe);
    }, { once: true });
  });

  /* ---- GENERIC IMAGE CAROUSEL ---- */
  document.querySelectorAll('.carousel').forEach(carousel => {
    const track = carousel.querySelector('.carousel-track');
    const slides = carousel.querySelectorAll('.carousel-slide');
    const dotsWrap = carousel.querySelector('.carousel-dots');
    const prev = carousel.querySelector('.carousel-prev');
    const next = carousel.querySelector('.carousel-next');
    if (!track || !slides.length) return;
    let idx = 0;
    function render() {
      track.style.transform = `translateX(-${idx * 100}%)`;
      if (dotsWrap) {
        dotsWrap.querySelectorAll('.dot').forEach((d, i) => d.classList.toggle('active', i === idx));
      }
    }
    if (dotsWrap) {
      dotsWrap.innerHTML = '';
      slides.forEach((_, i) => {
        const d = document.createElement('div');
        d.className = 'dot' + (i === 0 ? ' active' : '');
        d.addEventListener('click', () => { idx = i; render(); });
        dotsWrap.appendChild(d);
      });
    }
    prev && prev.addEventListener('click', () => { idx = (idx - 1 + slides.length) % slides.length; render(); });
    next && next.addEventListener('click', () => { idx = (idx + 1) % slides.length; render(); });
    let auto = setInterval(() => { idx = (idx + 1) % slides.length; render(); }, 4500);
    carousel.addEventListener('mouseenter', () => clearInterval(auto));
    carousel.addEventListener('mouseleave', () => { auto = setInterval(() => { idx = (idx + 1) % slides.length; render(); }, 4500); });
  });

});
