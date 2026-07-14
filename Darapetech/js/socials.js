/* =========================================
   DARAPET TECHNOLOGY — SOCIAL LINKS
   Reads saved values from localStorage and
   applies them to all social link elements.
   ========================================= */

function applySocials() {
  const map = {
    facebook:  { ids: ['footer-fb','drawer-fb'],  default: 'https://facebook.com' },
    twitter:   { ids: ['footer-tw','drawer-tw'],  default: 'https://x.com' },
    instagram: { ids: ['footer-ig','drawer-ig'],  default: 'https://instagram.com' },
    tiktok:    { ids: ['footer-tt','drawer-tt'],  default: 'https://tiktok.com' },
    linkedin:  { ids: ['footer-li','drawer-li'],  default: 'https://linkedin.com' },
    fiverr:    { ids: ['footer-fv','drawer-fv'],  default: 'https://fiverr.com' },
    upwork:    { ids: ['footer-uw','drawer-uw'],  default: 'https://upwork.com' },
  };

  Object.entries(map).forEach(([key, cfg]) => {
    const stored = localStorage.getItem('dt_social_' + key);
    const href = stored && stored.startsWith('http') ? stored : cfg.default;
    cfg.ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.href = href;
    });
  });
}

document.addEventListener('DOMContentLoaded', applySocials);
