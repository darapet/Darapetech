/* =====================================================================
   DARAPET TECHNOLOGY — BUYER-FACING AGENT PROFILE (seller.html)
   Reads ?agent=<agentId> from the URL and renders the public profile.
   Phone, email, age, and date of birth are NEVER shown to buyers.
   ===================================================================== */
(function () {
  'use strict';

  const app = document.getElementById('sellerApp');
  if (!app) return;

  const params  = new URLSearchParams(window.location.search);
  const agentId = params.get('agent') || params.get('id');

  if (!agentId) {
    renderError('No agent specified. Please use a valid profile link.');
    return;
  }

  const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  app.innerHTML = `<div style="max-width:900px;margin:0 auto;padding:32px 20px">
    <div style="text-align:center;padding:60px 20px;color:#64748b">
      <div style="width:32px;height:32px;border:3px solid #bfdbfe;border-top-color:#1d4ed8;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px"></div>
      Loading profile…
    </div>
  </div>`;

  // Try to find agent by agentId field, then fall back to document ID
  async function fetchAgent() {
    let snap = await db.collection('agents').where('agentId','==', agentId).limit(1).get();
    if (snap.empty) snap = await db.collection('agents').doc(agentId).get().then(d => d.exists ? {docs:[d],empty:false} : {docs:[],empty:true});
    return snap.empty ? null : snap.docs[0];
  }

  fetchAgent().then(doc => {
    if (!doc) { renderError('Agent profile not found.'); return; }
    const a = doc.data();
    if (!a.active) { renderError('This profile is not currently active.'); return; }
    renderProfile(a, doc.id);
  }).catch(e => renderError('Error loading profile: ' + e.message));

  function renderError(msg) {
    app.innerHTML = `<div style="max-width:680px;margin:60px auto;text-align:center;padding:20px">
      <div style="font-size:3rem;margin-bottom:16px">😕</div>
      <h2 style="font-weight:700;color:#0f172a;margin-bottom:8px">Profile Unavailable</h2>
      <p style="color:#64748b">${esc(msg)}</p>
      <a href="../index.html" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#1d4ed8;color:#fff;border-radius:10px;text-decoration:none;font-weight:600">Back to Home</a>
    </div>`;
  }

  function renderProfile(a, docId) {
    const photoEl = a.photoUrl
      ? `<img src="${esc(a.photoUrl)}" style="width:110px;height:110px;border-radius:20px;object-fit:cover;border:3px solid #bfdbfe;box-shadow:0 8px 24px rgba(0,0,0,.12)" />`
      : `<div style="width:110px;height:110px;border-radius:20px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:2.2rem;font-weight:700;box-shadow:0 8px 24px rgba(29,78,216,.3)">${esc(initials(a.name||a.displayName))}</div>`;

    const skillTags = (a.skills||[]).map(s=>`<span style="background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:100px;padding:3px 12px;font-size:.78rem;font-weight:500">${esc(s)}</span>`).join('');
    const langTags  = (a.languages||[]).map(l=>`<span style="background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;border-radius:100px;padding:3px 12px;font-size:.78rem;font-weight:500">${esc(l)}</span>`).join('');

    let portfolioHtml = '';
    if ((a.portfolio||[]).length) {
      portfolioHtml = `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-bottom:18px">
        <h3 style="font-family:'Space Grotesk',sans-serif;font-size:1rem;font-weight:700;margin-bottom:16px;color:#0f172a">Portfolio</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
          ${a.portfolio.map(p => {
            const imgEl = p.imageUrl
              ? `<img src="${esc(p.imageUrl)}" style="width:100%;height:140px;object-fit:cover;border-radius:10px;margin-bottom:10px" />`
              : `<div style="width:100%;height:100px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;color:#1d4ed8;font-size:1.6rem">💼</div>`;
            const period = [p.startDate, p.endDate].filter(Boolean).join(' – ');
            return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;cursor:default">
              ${imgEl}
              <div style="font-weight:700;font-size:.9rem;color:#0f172a;margin-bottom:3px">${esc(p.title||'Project')}</div>
              ${p.company?`<div style="font-size:.78rem;color:#3b82f6;font-weight:600">${esc(p.company)}</div>`:''}
              ${period?`<div style="font-size:.72rem;color:#94a3b8;margin-top:2px">${esc(period)}</div>`:''}
              ${p.description?`<div style="font-size:.8rem;color:#64748b;margin-top:6px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(p.description)}</div>`:''}
              ${p.url?`<a href="${esc(p.url)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;margin-top:8px;font-size:.76rem;color:#1d4ed8;font-weight:500;text-decoration:none"><i class="fas fa-external-link-alt" style="font-size:.65rem"></i> View Live</a>`:''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    let educationHtml = '';
    if ((a.education||[]).length) {
      educationHtml = `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-bottom:18px">
        <h3 style="font-family:'Space Grotesk',sans-serif;font-size:1rem;font-weight:700;margin-bottom:16px;color:#0f172a">Education</h3>
        ${a.education.map(e=>`
          <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9">
            <div style="width:38px;height:38px;border-radius:10px;background:#eff6ff;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <i class="fas fa-graduation-cap" style="color:#1d4ed8;font-size:.9rem"></i>
            </div>
            <div>
              <div style="font-weight:700;font-size:.88rem;color:#0f172a">${esc(e.degree||'—')}</div>
              <div style="font-size:.8rem;color:#3b82f6;font-weight:600">${esc(e.school||'')}</div>
              <div style="font-size:.74rem;color:#94a3b8">${esc(e.institutionType||'')}${e.year?' · '+esc(e.year):''}</div>
              ${e.course?`<div style="font-size:.76rem;color:#64748b;margin-top:2px">${esc(e.course)}</div>`:''}
            </div>
          </div>`).join('')}
      </div>`;
    }

    app.innerHTML = `
    <style>
      .seller-profile-wrap{max-width:900px;margin:0 auto;padding:32px 20px}
      @media(max-width:640px){.seller-profile-wrap{padding:16px 12px}}
    </style>
    <div class="seller-profile-wrap">

      <!-- Hero card -->
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:28px;margin-bottom:20px;display:flex;align-items:flex-start;gap:22px;flex-wrap:wrap">
        ${photoEl}
        <div style="flex:1;min-width:200px">
          <h1 style="font-family:'Space Grotesk',sans-serif;font-size:1.5rem;font-weight:700;color:#0f172a;margin-bottom:3px">${esc(a.displayName||a.name||'Agent')}</h1>
          <div style="font-size:.9rem;color:#3b82f6;font-weight:600;margin-bottom:6px">${esc(a.service||'')}${a.niche?' · '+esc(a.niche):''}</div>
          ${a.country?`<div style="font-size:.82rem;color:#64748b;margin-bottom:6px;display:flex;align-items:center;gap:5px"><i class="fas fa-map-marker-alt" style="color:#94a3b8"></i> ${esc(a.country)}</div>`:''}
          ${a.bio?`<p style="font-size:.88rem;color:#374151;line-height:1.65;max-width:560px;margin-bottom:8px">${esc(a.bio)}</p>`:''}
          <a href="chat.html?agent=${encodeURIComponent(docId)}" style="display:inline-flex;align-items:center;gap:7px;background:#1d4ed8;color:#fff;padding:10px 22px;border-radius:10px;font-size:.86rem;font-weight:600;text-decoration:none;transition:background .2s" onmouseover="this.style.background='#1e40af'" onmouseout="this.style.background='#1d4ed8'">
            <i class="fas fa-comment-dots"></i> Message ${esc((a.displayName||a.name||'Agent').split(' ')[0])}
          </a>
        </div>
      </div>

      <!-- About / Service description -->
      ${a.serviceDesc ? `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-bottom:18px">
        <h3 style="font-family:'Space Grotesk',sans-serif;font-size:1rem;font-weight:700;margin-bottom:10px;color:#0f172a">About My Services</h3>
        <p style="font-size:.88rem;color:#374151;line-height:1.7;white-space:pre-line">${esc(a.serviceDesc)}</p>
      </div>` : ''}

      <!-- Skills -->
      ${(a.skills||[]).length ? `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-bottom:18px">
        <h3 style="font-family:'Space Grotesk',sans-serif;font-size:1rem;font-weight:700;margin-bottom:12px;color:#0f172a">Skills</h3>
        <div style="display:flex;flex-wrap:wrap;gap:7px">${skillTags}</div>
      </div>` : ''}

      <!-- Languages -->
      ${(a.languages||[]).length ? `
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin-bottom:18px">
        <h3 style="font-family:'Space Grotesk',sans-serif;font-size:1rem;font-weight:700;margin-bottom:12px;color:#0f172a">Languages</h3>
        <div style="display:flex;flex-wrap:wrap;gap:7px">${langTags}</div>
      </div>` : ''}

      ${portfolioHtml}
      ${educationHtml}

    </div>`;
  }

  function initials(name) {
    return (name||'?').split(' ').map(w=>w[0]||'').slice(0,2).join('').toUpperCase();
  }
})();
