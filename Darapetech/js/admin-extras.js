/* =====================================================================
   DARAPET TECHNOLOGY — ADMIN EXTRAS
   renderAdminCustomers  — all registered site users (not agents)
   renderAdminPortfolioGallery — pick agent work → add to site portfolio
   Loaded by admin.html AFTER firebase-app.js
   ===================================================================== */

/* =====================================================================
   REGISTERED USERS
   Reads: db.collection('users')
   Fields stored at registration: username, email, avatarInitials, createdAt
   ===================================================================== */
async function renderAdminCustomers(el) {
  el.innerHTML = `
  <style>
    .users-table-wrap{overflow-x:auto}
    .users-table{width:100%;border-collapse:collapse;font-size:.84rem}
    .users-table th{padding:10px 14px;text-align:left;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);border-bottom:1px solid var(--border);white-space:nowrap}
    .users-table td{padding:12px 14px;border-bottom:1px solid var(--border);vertical-align:middle}
    .users-table tr:hover td{background:var(--bg-card)}
    .users-table tr:last-child td{border-bottom:none}
    .u-av{width:32px;height:32px;border-radius:10px;background:var(--accent-gradient);display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:.72rem;font-weight:700;flex-shrink:0}
    .u-email{font-size:.78rem;color:var(--text-muted)}
    .u-date{font-size:.76rem;color:var(--text-muted);white-space:nowrap}
    .users-search{padding:9px 14px;border:1.5px solid var(--border);border-radius:10px;font-family:inherit;font-size:.86rem;color:var(--text-primary);background:var(--bg-card);outline:none;width:260px;max-width:100%}
    .users-search:focus{border-color:var(--accent-1)}
    .users-summary-bar{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:20px}
    .users-summary-stat{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 18px;font-size:.84rem;font-weight:600;color:var(--text-primary)}
    .users-summary-stat span{display:block;font-size:1.25rem;font-weight:800;color:var(--accent-1);line-height:1}
    .empty-state{padding:40px;text-align:center;color:var(--text-muted);font-size:.88rem}
  </style>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
    <div>
      <h2 style="margin:0 0 4px">Registered Users</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin:0">Buyers and visitors who created an account on the site.</p>
    </div>
    <button class="btn btn-outline" style="font-size:.83rem" onclick="loadUsersTable()">
      <i class="ph-fill ph-arrow-clockwise"></i> Refresh
    </button>
  </div>

  <div class="users-summary-bar" id="usersSummaryBar">
    <div class="users-summary-stat"><span id="usersTotal">—</span>Total Users</div>
    <div class="users-summary-stat"><span id="usersThisMonth">—</span>This Month</div>
    <div class="users-summary-stat"><span id="usersThisWeek">—</span>This Week</div>
  </div>

  <div style="margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <input type="text" id="usersSearchInput" class="users-search" placeholder="Search by name or email…" />
    <select id="usersSortSelect" style="padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:inherit;font-size:.84rem;color:var(--text-primary);background:var(--bg-card);outline:none;cursor:pointer">
      <option value="newest">Newest first</option>
      <option value="oldest">Oldest first</option>
      <option value="name">Name A–Z</option>
    </select>
  </div>

  <div class="glass-card" style="padding:0;overflow:hidden" id="usersTableWrap">
    <div class="empty-state"><div style="width:24px;height:24px;border:3px solid #bfdbfe;border-top-color:#1d4ed8;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px"></div>Loading users…</div>
  </div>`;

  let allUsers = [];

  window.loadUsersTable = async function() {
    const wrap = document.getElementById('usersTableWrap');
    if (!wrap) return;
    try {
      const snap = await db.collection('users').orderBy('createdAt','desc').get();
      allUsers = snap.docs.map(d => ({ id:d.id, ...d.data() }));
      updateStats(allUsers);
      renderTable(allUsers);
    } catch(e) {
      wrap.innerHTML = `<div class="empty-state" style="color:#ef4444">Error: ${escapeHtml(e.message)}</div>`;
    }
  };

  function updateStats(users) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart  = new Date(now - 7*24*60*60*1000);
    document.getElementById('usersTotal').textContent = users.length;
    document.getElementById('usersThisMonth').textContent = users.filter(u => {
      if (!u.createdAt?.toDate) return false;
      return u.createdAt.toDate() >= monthStart;
    }).length;
    document.getElementById('usersThisWeek').textContent = users.filter(u => {
      if (!u.createdAt?.toDate) return false;
      return u.createdAt.toDate() >= weekStart;
    }).length;
  }

  function renderTable(users) {
    const wrap = document.getElementById('usersTableWrap');
    if (!wrap) return;
    if (!users.length) {
      wrap.innerHTML = '<div class="empty-state">No registered users found.</div>';
      return;
    }
    wrap.innerHTML = `
    <div class="users-table-wrap">
      <table class="users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Joined</th>
            <th style="text-align:center">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const ts = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
            const av = u.avatarInitials || (u.username||u.email||'?').slice(0,2).toUpperCase();
            return `<tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="u-av">${escapeHtml(av)}</div>
                  <div>
                    <div style="font-weight:700;font-size:.88rem">${escapeHtml(u.username||u.displayName||'—')}</div>
                    ${u.phone?`<div class="u-email">${escapeHtml(u.phone)}</div>`:''}
                  </div>
                </div>
              </td>
              <td><div class="u-email">${escapeHtml(u.email||'—')}</div></td>
              <td><div class="u-date">${escapeHtml(ts)}</div></td>
              <td style="text-align:center">
                <button class="btn btn-outline" style="font-size:.74rem;padding:4px 12px" onclick="viewUserDetail('${u.id}')">
                  <i class="ph-fill ph-eye"></i> View
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  }

  function filterAndSort() {
    const q    = (document.getElementById('usersSearchInput')?.value || '').toLowerCase();
    const sort = document.getElementById('usersSortSelect')?.value || 'newest';
    let list = allUsers.filter(u =>
      (u.username||'').toLowerCase().includes(q) ||
      (u.email||'').toLowerCase().includes(q)
    );
    if (sort === 'oldest') list = [...list].reverse();
    else if (sort === 'name') list.sort((a,b) => (a.username||'').localeCompare(b.username||''));
    renderTable(list);
  }

  document.getElementById('usersSearchInput')?.addEventListener('input', filterAndSort);
  document.getElementById('usersSortSelect')?.addEventListener('change', filterAndSort);

  window.viewUserDetail = async function(uid) {
    const existing = document.getElementById('userDetailOverlay');
    if (existing) existing.remove();
    let u;
    try {
      const doc = await db.collection('users').doc(uid).get();
      u = doc.exists ? { id:doc.id, ...doc.data() } : allUsers.find(x=>x.id===uid);
    } catch(e) { u = allUsers.find(x=>x.id===uid); }
    if (!u) { alert('User not found.'); return; }
    const ts = u.createdAt?.toDate ? u.createdAt.toDate().toLocaleString() : '—';
    const overlay = document.createElement('div');
    overlay.id = 'userDetailOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:28px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.3)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h3 style="font-size:1rem;font-weight:700">User Detail</h3>
          <button onclick="document.getElementById('userDetailOverlay').remove()" style="width:28px;height:28px;border-radius:8px;background:#f1f5f9;border:none;cursor:pointer;color:#64748b;font-size:.85rem">✕</button>
        </div>
        <div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem;font-weight:700;margin-bottom:18px">
          ${escapeHtml((u.avatarInitials||u.username||'?').slice(0,2).toUpperCase())}
        </div>
        <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f1f5f9;display:flex;gap:8px">
          <div style="font-size:.74rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;width:100px;flex-shrink:0;padding-top:2px">Username</div>
          <div style="font-size:.88rem;color:#0f172a">${escapeHtml(u.username||u.displayName||'—')}</div>
        </div>
        <div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f1f5f9;display:flex;gap:8px">
          <div style="font-size:.74rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;width:100px;flex-shrink:0;padding-top:2px">Email</div>
          <div style="font-size:.88rem;color:#0f172a">${escapeHtml(u.email||'—')}</div>
        </div>
        ${u.phone?`<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #f1f5f9;display:flex;gap:8px">
          <div style="font-size:.74rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;width:100px;flex-shrink:0;padding-top:2px">Phone</div>
          <div style="font-size:.88rem;color:#0f172a">${escapeHtml(u.phone)}</div>
        </div>`:''}
        <div style="margin-bottom:0;display:flex;gap:8px">
          <div style="font-size:.74rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;width:100px;flex-shrink:0;padding-top:2px">Joined</div>
          <div style="font-size:.88rem;color:#0f172a">${escapeHtml(ts)}</div>
        </div>
        <div style="margin-top:20px;display:flex;justify-content:flex-end">
          <button onclick="document.getElementById('userDetailOverlay').remove()" style="padding:9px 18px;background:#f1f5f9;color:#374151;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.86rem;font-weight:600;cursor:pointer;font-family:inherit">Close</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });
  };

  window.loadUsersTable();
}

/* =====================================================================
   PORTFOLIO GALLERY — browse ALL agent portfolio items and
   promote any item into the company's public portfolio.
   ===================================================================== */
const SERVICE_NICHES_ADM = {
  'Web & App Development': ['Website Development','WordPress Development','Shopify Development','Mobile App Development','React.js / Next.js','Vue.js / Nuxt.js','Node.js / Express','PHP Development','E-Commerce Stores','Landing Page Design','Web Maintenance','UI/UX Design & Prototyping','API Development','Custom Web Apps'],
  'Video Editing':         ['YouTube Videos','Short-Form Reels & TikTok','Corporate / Brand Videos','Motion Graphics & Animation','Color Grading & Sound Design','Podcast Video Production','Wedding & Events','Video Ads & Commercials','After Effects & VFX','Subtitles & Captions'],
  'Graphics & Design':     ['Logo Design & Brand Identity','Social Media Graphics','Print Design','UI/UX Design','Packaging Design','Infographics & Data Visualisation','Pitch Decks & Presentations','Illustrations & Artwork','Icon Design','Stationery Design'],
  'Digital Marketing':     ['SEO','Google Ads / PPC','Facebook & Instagram Ads','TikTok Ads','Social Media Management','Content Strategy & Copywriting','Influencer Marketing','YouTube SEO & Growth','Marketing Funnels','Analytics & Reporting'],
  'Email Marketing':       ['Email Campaign Design','Newsletter Creation','Drip & Automation Flows','List Building & Segmentation','Lead Nurturing','Mailchimp','Klaviyo','Brevo/Sendinblue','CRM Integration','Email Analytics']
};

async function renderAdminPortfolioGallery(el) {
  el.innerHTML = `
  <style>
    .pg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-top:20px}
    .pg-card{background:var(--bg-card);border:1px solid var(--border);border-radius:14px;overflow:hidden;transition:all .2s;cursor:default}
    .pg-card:hover{border-color:var(--border-hover);box-shadow:0 4px 20px rgba(0,0,0,.07)}
    .pg-thumb{width:100%;height:160px;object-fit:cover;display:block;background:linear-gradient(135deg,rgba(37,99,235,.1),rgba(96,165,250,.1))}
    .pg-thumb-ph{width:100%;height:160px;background:linear-gradient(135deg,rgba(37,99,235,.08),rgba(96,165,250,.12));display:flex;align-items:center;justify-content:center;font-size:2.4rem;color:rgba(37,99,235,.3)}
    .pg-body{padding:14px}
    .pg-title{font-weight:700;font-size:.9rem;color:var(--text-primary);margin-bottom:3px}
    .pg-company{font-size:.78rem;color:var(--accent-1);font-weight:600}
    .pg-agent{font-size:.74rem;color:var(--text-muted);margin-top:3px}
    .pg-service{font-size:.72rem;background:rgba(37,99,235,.1);color:var(--accent-1);padding:2px 8px;border-radius:100px;display:inline-block;margin-top:4px}
    .pg-desc{font-size:.78rem;color:var(--text-secondary);margin-top:7px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    .pg-actions{display:flex;gap:6px;padding:10px 14px;border-top:1px solid var(--border);flex-wrap:wrap}
    .pg-btn-add{font-size:.75rem;padding:5px 12px;border-radius:7px;background:#1d4ed8;color:#fff;border:none;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px;transition:background .15s}
    .pg-btn-add:hover{background:#1e40af}
    .pg-btn-view{font-size:.75rem;padding:5px 12px;border-radius:7px;background:transparent;color:var(--text-secondary);border:1px solid var(--border);cursor:pointer;font-family:inherit;transition:all .15s}
    .pg-btn-view:hover{border-color:var(--accent-1);color:var(--accent-1)}
    .pg-added-badge{font-size:.72rem;color:#10b981;font-weight:700;display:flex;align-items:center;gap:3px}
    .pg-filter-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:4px}
    .pg-filter-select{padding:8px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:inherit;font-size:.83rem;color:var(--text-primary);background:var(--bg-card);outline:none;cursor:pointer}
    .pg-filter-select:focus{border-color:var(--accent-1)}
    .pg-search{padding:8px 13px;border:1.5px solid var(--border);border-radius:10px;font-family:inherit;font-size:.84rem;color:var(--text-primary);background:var(--bg-card);outline:none;width:220px}
    .pg-search:focus{border-color:var(--accent-1)}
    /* Add-to-portfolio modal */
    .atp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}
    .atp-box{background:#fff;border-radius:16px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)}
    .atp-field{margin-bottom:14px}
    .atp-field label{display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:5px}
    .atp-field input,.atp-field select,.atp-field textarea{width:100%;padding:9px 13px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.86rem;font-family:inherit;color:#0f172a;outline:none;transition:border .2s}
    .atp-field input:focus,.atp-field select:focus,.atp-field textarea:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1)}
    .atp-thumb-preview{width:100%;height:140px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:14px;display:block}
    .atp-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
    .atp-btn-cancel{padding:9px 18px;background:#f1f5f9;color:#374151;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.86rem;font-weight:600;cursor:pointer;font-family:inherit}
    .atp-btn-add{padding:9px 20px;background:#1d4ed8;color:#fff;border:none;border-radius:10px;font-size:.86rem;font-weight:600;cursor:pointer;font-family:inherit;transition:background .2s}
    .atp-btn-add:hover{background:#1e40af}
    .atp-btn-add:disabled{opacity:.6;cursor:not-allowed}
    .atp-err{color:#ef4444;font-size:.8rem;margin-top:8px;display:none}
  </style>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px">
    <div>
      <h2 style="margin:0 0 4px">Portfolio Gallery</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin:0">Browse all agent portfolio items. Pick the best ones to feature on the company's public portfolio — choose the service category before publishing.</p>
    </div>
    <button class="btn btn-outline" style="font-size:.83rem" onclick="loadPortfolioGallery()">
      <i class="ph-fill ph-arrow-clockwise"></i> Refresh
    </button>
  </div>

  <div class="pg-filter-bar">
    <input type="text" id="pgSearch" class="pg-search" placeholder="Search title or agent…" />
    <select id="pgServiceFilter" class="pg-filter-select">
      <option value="">All Services</option>
      <option value="Web & App Development">Web &amp; App Dev</option>
      <option value="Video Editing">Video Editing</option>
      <option value="Graphics & Design">Graphics &amp; Design</option>
      <option value="Digital Marketing">Digital Marketing</option>
      <option value="Email Marketing">Email Marketing</option>
    </select>
    <select id="pgAddedFilter" class="pg-filter-select">
      <option value="">All Items</option>
      <option value="pending">Not yet added</option>
      <option value="added">Already added</option>
    </select>
    <span id="pgCount" style="font-size:.8rem;color:var(--text-muted);margin-left:auto"></span>
  </div>

  <div class="pg-grid" id="pgGrid">
    <div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-muted)">
      <div style="width:26px;height:26px;border:3px solid #bfdbfe;border-top-color:#1d4ed8;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px"></div>
      Loading agent portfolio items…
    </div>
  </div>`;

  let allItems = [];
  let addedUrls = new Set();

  window.loadPortfolioGallery = async function() {
    const grid = document.getElementById('pgGrid');
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-muted)"><div style="width:26px;height:26px;border:3px solid #bfdbfe;border-top-color:#1d4ed8;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px"></div>Loading…</div>';
    try {
      // Load existing company portfolio to mark already-added items
      const compSnap = await db.collection('portfolio').get();
      addedUrls = new Set(compSnap.docs.map(d => d.data().sourceItemKey).filter(Boolean));

      // Load all agents and their portfolio arrays
      const agentsSnap = await db.collection('agents').where('active','==',true).get();
      allItems = [];
      agentsSnap.docs.forEach(doc => {
        const a = doc.data();
        (a.portfolio || []).forEach((item, idx) => {
          if (!item.title) return;
          const key = `${doc.id}_${idx}`;
          allItems.push({
            agentDocId: doc.id, idx, key,
            agentName: a.displayName || a.name || '—',
            agentService: a.service || '',
            ...item,
            alreadyAdded: addedUrls.has(key)
          });
        });
      });
      applyPgFilters();
    } catch(e) {
      grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;text-align:center;color:#ef4444;font-size:.85rem">Error: ${escapeHtml(e.message)}</div>`;
    }
  };

  function applyPgFilters() {
    const q       = (document.getElementById('pgSearch')?.value || '').toLowerCase();
    const service = document.getElementById('pgServiceFilter')?.value || '';
    const added   = document.getElementById('pgAddedFilter')?.value || '';
    let list = allItems.filter(item => {
      if (q && !(item.title||'').toLowerCase().includes(q) && !(item.agentName||'').toLowerCase().includes(q) && !(item.company||'').toLowerCase().includes(q)) return false;
      if (service && item.agentService !== service) return false;
      if (added === 'pending' && item.alreadyAdded) return false;
      if (added === 'added'   && !item.alreadyAdded) return false;
      return true;
    });
    const count = document.getElementById('pgCount');
    if (count) count.textContent = `${list.length} item${list.length!==1?'s':''} found`;
    renderPgGrid(list);
  }

  function renderPgGrid(items) {
    const grid = document.getElementById('pgGrid');
    if (!grid) return;
    if (!items.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-muted);font-size:.88rem">No portfolio items match your filters.</div>';
      return;
    }
    grid.innerHTML = items.map(item => {
      const imgEl = item.imageUrl
        ? `<img src="${escapeHtml(item.imageUrl)}" class="pg-thumb" loading="lazy" />`
        : `<div class="pg-thumb-ph">💼</div>`;
      const period = [item.startDate, item.endDate].filter(Boolean).join(' – ');
      return `<div class="pg-card" id="pgc-${item.key}">
        ${imgEl}
        <div class="pg-body">
          <div class="pg-title">${escapeHtml(item.title||'Untitled')}</div>
          ${item.company?`<div class="pg-company">${escapeHtml(item.company)}</div>`:''}
          <div class="pg-agent"><i class="ph-fill ph-user" style="font-size:.7rem"></i> ${escapeHtml(item.agentName)}</div>
          <span class="pg-service">${escapeHtml(item.agentService||'—')}</span>
          ${period?`<div style="font-size:.7rem;color:var(--text-muted);margin-top:3px">${escapeHtml(period)}</div>`:''}
          ${item.description?`<div class="pg-desc">${escapeHtml(item.description)}</div>`:''}
        </div>
        <div class="pg-actions">
          ${item.alreadyAdded
            ? `<span class="pg-added-badge"><i class="ph-fill ph-check-circle"></i> Added to Portfolio</span>`
            : `<button class="pg-btn-add" onclick="openAddToPortfolioModal('${item.key}')"><i class="ph-fill ph-plus"></i> Add to Portfolio</button>`
          }
          ${item.url?`<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" style="text-decoration:none"><button class="pg-btn-view"><i class="ph-fill ph-arrow-square-out"></i> Live</button></a>`:''}
        </div>
      </div>`;
    }).join('');
  }

  ['pgSearch','pgServiceFilter','pgAddedFilter'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', applyPgFilters);
    document.getElementById(id)?.addEventListener('input', applyPgFilters);
  });

  window.openAddToPortfolioModal = function(itemKey) {
    const item = allItems.find(x=>x.key===itemKey);
    if (!item) return;
    const existing = document.getElementById('atpOverlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'atp-overlay'; overlay.id = 'atpOverlay';
    overlay.innerHTML = `
      <div class="atp-box">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">
          <h3 style="font-size:1.05rem;font-weight:700;color:#0f172a">Add to Company Portfolio</h3>
          <button onclick="document.getElementById('atpOverlay').remove()" style="width:28px;height:28px;border-radius:8px;background:#f1f5f9;border:none;cursor:pointer;color:#64748b;font-size:.85rem">✕</button>
        </div>
        ${item.imageUrl?`<img src="${escapeHtml(item.imageUrl)}" class="atp-thumb-preview" />`:''}
        <div class="atp-field">
          <label>Project Title *</label>
          <input type="text" id="atpTitle" value="${escapeHtml(item.title||'')}" />
        </div>
        <div class="atp-field">
          <label>Description</label>
          <textarea id="atpDesc" rows="3">${escapeHtml(item.description||'')}</textarea>
        </div>
        <div class="atp-field">
          <label>Service Category *</label>
          <select id="atpService">
            <option value="">— Select service —</option>
            <option value="Web & App Development" ${item.agentService==='Web & App Development'?'selected':''}>Web &amp; App Development</option>
            <option value="Video Editing" ${item.agentService==='Video Editing'?'selected':''}>Video Editing</option>
            <option value="Graphics & Design" ${item.agentService==='Graphics & Design'?'selected':''}>Graphics &amp; Design</option>
            <option value="Digital Marketing" ${item.agentService==='Digital Marketing'?'selected':''}>Digital Marketing</option>
            <option value="Email Marketing" ${item.agentService==='Email Marketing'?'selected':''}>Email Marketing</option>
          </select>
        </div>
        <div class="atp-field" id="atpNicheWrap" style="display:none">
          <label>Sub-Service / Niche</label>
          <select id="atpNiche"><option value="">— Select —</option></select>
        </div>
        <div class="atp-field">
          <label>Project URL <span style="color:#94a3b8;font-weight:400">(optional)</span></label>
          <input type="url" id="atpUrl" value="${escapeHtml(item.url||'')}" placeholder="https://…" />
        </div>
        <label style="display:flex;align-items:center;gap:9px;cursor:pointer;margin-bottom:8px">
          <input type="checkbox" id="atpFeatured" style="width:16px;height:16px" />
          <span style="font-size:.86rem;font-weight:500;color:#374151">Mark as Featured on homepage</span>
        </label>
        <div class="atp-err" id="atpErr"></div>
        <div class="atp-actions">
          <button class="atp-btn-cancel" onclick="document.getElementById('atpOverlay').remove()">Cancel</button>
          <button class="atp-btn-add" id="atpSaveBtn"><i class="ph-fill ph-check"></i> Add to Portfolio</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if(e.target===overlay) overlay.remove(); });

    // Populate niche on service change
    const svcSel = document.getElementById('atpService');
    const nicheWrap = document.getElementById('atpNicheWrap');
    const nicheSel = document.getElementById('atpNiche');
    function updateNiches() {
      const svc = svcSel.value;
      if (!svc) { nicheWrap.style.display='none'; return; }
      const niches = SERVICE_NICHES_ADM[svc] || [];
      nicheSel.innerHTML = '<option value="">— Select —</option>' + niches.map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
      nicheWrap.style.display = '';
    }
    svcSel.addEventListener('change', updateNiches);
    // Pre-populate niche if service is already set
    if (svcSel.value) updateNiches();

    document.getElementById('atpSaveBtn').addEventListener('click', async () => {
      const title   = document.getElementById('atpTitle').value.trim();
      const service = document.getElementById('atpService').value;
      const errEl   = document.getElementById('atpErr');
      errEl.style.display = 'none';
      if (!title)   { errEl.textContent='Please enter a project title.'; errEl.style.display=''; return; }
      if (!service) { errEl.textContent='Please select a service category.'; errEl.style.display=''; return; }
      const btn = document.getElementById('atpSaveBtn');
      btn.disabled = true; btn.innerHTML = '<i class="ph-fill ph-spinner"></i> Saving…';
      try {
        // Get current max sort order
        const existing = await db.collection('portfolio').orderBy('sortOrder','desc').limit(1).get();
        const maxSort  = existing.empty ? 0 : (existing.docs[0].data().sortOrder || 0);
        await db.collection('portfolio').add({
          title,
          description: document.getElementById('atpDesc').value.trim(),
          category: service,
          subCategory: document.getElementById('atpNiche').value || '',
          imageUrl: item.imageUrl || '',
          projectUrl: document.getElementById('atpUrl').value.trim(),
          featured: document.getElementById('atpFeatured').checked,
          tags: [service, document.getElementById('atpNiche').value].filter(Boolean),
          sourceAgentId:   item.agentDocId,
          sourceAgentName: item.agentName,
          sourceItemKey:   itemKey,
          sortOrder: maxSort + 1,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        // Mark item as added locally
        allItems.forEach(x => { if(x.key===itemKey) x.alreadyAdded=true; });
        addedUrls.add(itemKey);
        overlay.remove();
        // Update card in grid
        const card = document.getElementById('pgc-'+itemKey);
        if (card) {
          const actionsDiv = card.querySelector('.pg-actions');
          if (actionsDiv) {
            const addBtn = actionsDiv.querySelector('.pg-btn-add');
            if (addBtn) addBtn.outerHTML = `<span class="pg-added-badge"><i class="ph-fill ph-check-circle"></i> Added to Portfolio</span>`;
          }
        }
        // Toast
        const toast = document.createElement('div');
        toast.style.cssText='position:fixed;bottom:24px;right:24px;background:#10b981;color:#fff;padding:12px 20px;border-radius:10px;font-size:.86rem;font-weight:600;z-index:300;box-shadow:0 8px 24px rgba(0,0,0,.2)';
        toast.textContent = `✓ "${title}" added to company portfolio!`;
        document.body.appendChild(toast);
        setTimeout(()=>toast.remove(),4000);
      } catch(e) {
        errEl.textContent = 'Save failed: '+e.message; errEl.style.display='';
        btn.disabled=false; btn.innerHTML='<i class="ph-fill ph-check"></i> Add to Portfolio';
      }
    });
  };

  window.loadPortfolioGallery();
}
