/* =========================================
   DARAPET TECHNOLOGY — AGENT DASHBOARD JS
   Agent workspace: conversations + chat + settings
   ========================================= */
(function () {
  'use strict';

  const TS = () => firebase.firestore.FieldValue.serverTimestamp();

  // ---- Cloudinary upload (replaces Firebase Storage) ----
  let _cloudinaryCfg = null;
  async function getCloudinaryCfg() {
    if (_cloudinaryCfg) return _cloudinaryCfg;
    const doc = await db.collection('settings').doc('cloudinary').get();
    if (!doc.exists) throw new Error('Cloudinary not configured. Go to Admin → Settings to set your cloud name and upload preset.');
    _cloudinaryCfg = doc.data();
    return _cloudinaryCfg;
  }
  async function uploadToCloudinary(file, folder) {
    const { cloudName, uploadPreset } = await getCloudinaryCfg();
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', uploadPreset);
    fd.append('folder', folder || 'chat');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed');
    return data.secure_url;
  }

  const SERVICES_SKILLS = {
    'Web & App Development': ['Website Development','WordPress','Shopify','Mobile App Development','React.js','Vue.js','Node.js','PHP','MySQL','PostgreSQL','REST API','GraphQL','UI/UX Design','Figma','HTML/CSS','JavaScript','TypeScript','Git','Docker','AWS'],
    'Video Editing': ['Adobe Premiere Pro','After Effects','DaVinci Resolve','Motion Graphics','Color Grading','Sound Design','YouTube Videos','Short-Form/Reels','Corporate Videos','2D Animation','Subtitles & Captions','Thumbnail Design','VFX','Transitions','4K Editing','Audio Mixing','Storyboarding','Green Screen','Drone Footage','Brand Videos'],
    'Graphics & Design': ['Adobe Illustrator','Photoshop','InDesign','Figma','Logo Design','Brand Identity','UI/UX Design','Social Media Graphics','Print Design','Typography','Packaging Design','Infographics','Pitch Decks','Icon Design','Illustrations','Mockups','Banner Design','Email Templates','Business Cards','Poster Design'],
    'Digital Marketing': ['SEO','Google Ads','Facebook Ads','Instagram Ads','TikTok Ads','Email Campaigns','Content Strategy','Social Media Management','Analytics','Conversion Optimization','Copywriting','Keyword Research','Link Building','YouTube SEO','Influencer Outreach','A/B Testing','Landing Pages','Marketing Funnels','Brand Awareness','Competitor Analysis'],
    'Email Marketing': ['Mailchimp','Brevo/Sendinblue','Klaviyo','Campaign Monitor','Email Design','List Segmentation','Automation Flows','A/B Testing','Newsletter Design','Drip Campaigns','Lead Nurturing','Email Analytics','Subscriber Growth','Deliverability','GDPR Compliance','Welcome Sequences','Re-engagement Campaigns','Transactional Emails','Template Design','CRM Integration']
  };

  let agentData = null;
  let currentUser = null;
  let allConvs = [];
  let selectedConvId = null;
  let msgUnsub = null;
  let convsUnsub = null;
  let agentSkills = [];
  let pendingFiles = [];

  // ---- BOOT ----
  auth.onAuthStateChanged(async user => {
    if (!user) { window.location = 'agent-login.html'; return; }
    currentUser = user;
    // Verify this is an agent
    const snap = await db.collection('agents').where('uid','==',user.uid).limit(1).get();
    if (snap.empty) { auth.signOut(); window.location = 'agent-login.html'; return; }
    agentData = { docId: snap.docs[0].id, ...snap.docs[0].data() };
    agentSkills = agentData.skills || [];

    // Check firstLogin
    if (agentData.firstLogin) { window.location = 'agent-login.html'; return; }

    initDashboard();
  });

  function initDashboard() {
    // Set sidebar info
    setSidebarAgent();
    setupNav();
    loadConversations();
    setupSettings();
    document.getElementById('signOutBtn').addEventListener('click', () => { auth.signOut(); window.location = 'agent-login.html'; });
  }

  function setSidebarAgent() {
    document.getElementById('sidebarName').textContent = agentData.name || 'Agent';
    document.getElementById('sidebarService').textContent = agentData.service || '';
    const avEl = document.getElementById('sidebarAvatar');
    if (agentData.photoUrl) {
      avEl.outerHTML = `<img src="${esc(agentData.photoUrl)}" class="agent-av" id="sidebarAvatar" />`;
    } else {
      avEl.textContent = (agentData.name||'A').slice(0,2).toUpperCase();
    }
  }

  // ---- NAV TABS ----
  function setupNav() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const tab = item.dataset.tab;
        document.getElementById('tabChats').style.display = (tab === 'chats') ? 'flex' : 'none';
        document.getElementById('tabSettings').classList.toggle('visible', tab === 'settings' || tab === 'profile');
      });
    });
  }

  // ---- CONVERSATIONS ----
  function loadConversations() {
    const listEl = document.getElementById('convsList');
    listEl.innerHTML = '<div class="convs-empty">Loading…</div>';

    convsUnsub = db.collection('agent_conversations')
      .where('agentId','==',agentData.id || agentData.docId)
      .orderBy('lastMessageAt','desc')
      .onSnapshot(snap => {
        allConvs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderConvList(allConvs);
        // Update unread badge
        const totalUnread = allConvs.reduce((sum, c) => sum + (c.unreadAgent||0), 0);
        const badge = document.getElementById('unreadCount');
        badge.textContent = totalUnread;
        badge.style.display = totalUnread > 0 ? 'inline' : 'none';
      });
  }

  function renderConvList(convs) {
    const listEl = document.getElementById('convsList');
    if (!convs.length) { listEl.innerHTML = '<div class="convs-empty">No conversations yet.<br>Users will appear here when they start chatting.</div>'; return; }
    listEl.innerHTML = convs.map(c => {
      const ts = c.lastMessageAt?.toDate ? c.lastMessageAt.toDate().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '';
      const initials = (c.userName||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      const preview = (c.lastMessage||'No messages yet').slice(0,40);
      return `<div class="conv-item${c.id===selectedConvId?' active':''}" data-conv-id="${esc(c.id)}">
        <div class="conv-av">${esc(initials)}</div>
        <div class="conv-info">
          <div class="conv-name">${esc(c.userName||'Unknown User')}</div>
          <div class="conv-preview">${esc(preview)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          <span class="conv-time">${ts}</span>
          ${(c.unreadAgent||0) > 0 ? `<span class="conv-unread"></span>` : ''}
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.conv-item').forEach(item => {
      item.addEventListener('click', () => {
        const convId = item.dataset.convId;
        const conv = allConvs.find(c => c.id === convId);
        if (conv) openConversation(conv, item);
      });
    });
  }

  function openConversation(conv, itemEl) {
    document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('active'));
    if (itemEl) itemEl.classList.add('active');
    selectedConvId = conv.id;
    // Reset unread for agent
    db.collection('agent_conversations').doc(conv.id).update({ unreadAgent: 0 }).catch(()=>{});
    renderChatArea(conv);
    subscribeMessages(conv);
  }

  function renderChatArea(conv) {
    const chatArea = document.getElementById('chatArea');
    const initials = (conv.userName||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    chatArea.innerHTML = `
      <div class="chat-header-bar">
        <div class="chat-header-av">${esc(initials)}</div>
        <div class="chat-header-info">
          <div class="chat-header-name">${esc(conv.userName||'User')}</div>
          <div class="chat-header-meta">${esc(conv.userEmail||'')}</div>
        </div>
      </div>
      <div class="messages-wrap" id="agentMsgWrap"></div>
      <div class="input-bar">
        <div class="attach-row" id="agentAttachRow"></div>
        <div class="input-row-a">
          <button class="att-btn" id="agentImgBtn" title="Send image"><i class="fas fa-image"></i></button>
          <button class="att-btn" id="agentFileBtn" title="Send file"><i class="fas fa-paperclip"></i></button>
          <textarea class="msg-ta" id="agentMsgInput" placeholder="Type your reply…" rows="1"></textarea>
          <button class="snd-btn" id="agentSendBtn"><i class="fas fa-paper-plane"></i></button>
        </div>
      </div>`;

    document.getElementById('agentSendBtn').addEventListener('click', sendAgentMessage);
    document.getElementById('agentMsgInput').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAgentMessage(); }
    });
    document.getElementById('agentMsgInput').addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    document.getElementById('agentImgBtn').addEventListener('click', () => document.getElementById('chatImageInput').click());
    document.getElementById('agentFileBtn').addEventListener('click', () => document.getElementById('chatFileInput').click());

    document.getElementById('chatImageInput').onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => { pendingFiles.push({ type:'image', file, previewUrl: ev.target.result }); renderAgentPreviews(); };
      reader.readAsDataURL(file); e.target.value = '';
    };
    document.getElementById('chatFileInput').onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      pendingFiles.push({ type:'file', file, previewUrl: null }); renderAgentPreviews(); e.target.value = '';
    };
  }

  function renderAgentPreviews() {
    const row = document.getElementById('agentAttachRow');
    if (!row) return;
    row.className = pendingFiles.length ? 'attach-row has-items' : 'attach-row';
    row.innerHTML = pendingFiles.map((f, i) => {
      if (f.type === 'image') return `<div class="a-prev"><img src="${f.previewUrl}" /><button class="rm" onclick="removeAgentFile(${i})">×</button></div>`;
      return `<div class="a-file-badge"><i class="fas fa-file-alt"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90px">${esc(f.file.name)}</span><button class="rm" onclick="removeAgentFile(${i})">×</button></div>`;
    }).join('');
  }
  window.removeAgentFile = i => { pendingFiles.splice(i,1); renderAgentPreviews(); };

  async function sendAgentMessage() {
    if (!selectedConvId || !agentData) return;
    const input = document.getElementById('agentMsgInput');
    const text = (input?.value||'').trim();
    if (!text && !pendingFiles.length) return;
    const btn = document.getElementById('agentSendBtn');
    if (btn) btn.disabled = true;
    if (input) input.value = '';

    const base = {
      conversationId: selectedConvId,
      senderId: currentUser.uid,
      senderType: 'agent',
      senderName: agentData.name || 'Agent',
      createdAt: TS()
    };

    for (const att of pendingFiles) {
      try {
        const url = await uploadToCloudinary(att.file, 'chat');
        await db.collection('agent_messages').add({ ...base, type: att.type, fileUrl: url, fileName: att.file.name, content: '' });
      } catch(e) { console.error('Upload error:', e.message); }
    }

    if (text) {
      const urlPattern = /^(https?:\/\/[^\s]+)$/i;
      const msgType = urlPattern.test(text) ? 'url' : 'text';
      await db.collection('agent_messages').add({ ...base, type: msgType, content: text });
    }

    db.collection('agent_conversations').doc(selectedConvId).update({
      lastMessage: text || '[attachment]',
      lastMessageAt: TS(),
      unreadUser: firebase.firestore.FieldValue.increment(1)
    }).catch(()=>{});

    pendingFiles = [];
    renderAgentPreviews();
    if (btn) btn.disabled = false;
  }

  function subscribeMessages(conv) {
    if (msgUnsub) msgUnsub();
    // NOTE: no .orderBy() here — an equality filter combined with an orderBy
    // on a different field requires a Firestore composite index that was
    // never created, which made this listener fail silently. Sorting
    // client-side avoids needing that index.
    msgUnsub = db.collection('agent_messages')
      .where('conversationId','==',conv.id)
      .onSnapshot(snap => {
        const wrap = document.getElementById('agentMsgWrap');
        if (!wrap) return;
        wrap.innerHTML = '';
        if (snap.empty) {
          wrap.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:.85rem">Conversation started. Reply to the user below.</div>';
          return;
        }
        const docs = snap.docs.slice().sort((a, b) => {
          const ta = a.data().createdAt?.toMillis ? a.data().createdAt.toMillis() : 0;
          const tb = b.data().createdAt?.toMillis ? b.data().createdAt.toMillis() : 0;
          return ta - tb;
        });
        let lastDay = '';
        docs.forEach(doc => {
          const m = doc.data();
          const ts = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
          const dayStr = ts.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
          if (dayStr !== lastDay) {
            lastDay = dayStr;
            const sep = document.createElement('div');
            sep.className = 'day-sep';
            sep.textContent = dayStr;
            wrap.appendChild(sep);
          }
          const isMine = m.senderType === 'agent';
          const time = ts.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
          const row = document.createElement('div');
          row.className = `msg-row ${isMine ? 'mine' : 'theirs'}`;

          let contentHtml = '';
          if (m.type === 'image') {
            contentHtml = `<div class="bubble" style="padding:4px;background:transparent;border:none"><img src="${esc(m.fileUrl)}" class="msg-img" onclick="window.open('${esc(m.fileUrl)}','_blank')" /></div>`;
          } else if (m.type === 'file') {
            contentHtml = `<a class="msg-file-a" href="${esc(m.fileUrl)}" target="_blank" rel="noopener"><i class="fas fa-file-alt"></i><span>${esc(m.fileName||'File')}</span></a>`;
          } else if (m.type === 'url') {
            contentHtml = `<div class="bubble"><a class="msg-url-a" href="${esc(m.content)}" target="_blank" rel="noopener">${esc(m.content)}</a></div>`;
          } else {
            contentHtml = `<div class="bubble">${escHtml(m.content||'')}</div>`;
          }

          const userInitials = (conv.userName||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
          const avatarEl = isMine
            ? (agentData.photoUrl ? `<img src="${esc(agentData.photoUrl)}" class="msg-av-a" />` : `<div class="msg-av-a-ph">${(agentData.name||'A').slice(0,2).toUpperCase()}</div>`)
            : `<div class="msg-av-u">${userInitials}</div>`;

          row.innerHTML = `${avatarEl}<div><div>${contentHtml}</div><div class="msg-time">${time}</div></div>`;
          wrap.appendChild(row);
        });
        wrap.scrollTop = wrap.scrollHeight;
      }, err => {
        console.error('Chat listen error:', err);
        const wrap = document.getElementById('agentMsgWrap');
        if (wrap) wrap.innerHTML = '<div style="text-align:center;padding:40px;color:#94a3b8;font-size:.85rem">Could not load messages. Please refresh and try again.</div>';
      });
  }

  // ---- SETTINGS ----
  function setupSettings() {
    // Populate service select
    const svcSel = document.getElementById('settingsService');
    Object.keys(SERVICES_SKILLS).forEach(s => {
      const o = document.createElement('option');
      o.value = s; o.textContent = s;
      if (s === agentData.service) o.selected = true;
      svcSel.appendChild(o);
    });
    svcSel.addEventListener('change', populateSkillSelect);

    // Prefill
    document.getElementById('settingsName').value = agentData.name || '';
    document.getElementById('settingsBio').value = agentData.bio || '';

    // Skills
    populateSkillSelect();
    renderSkillTags();

    // Photo
    const photoWrap = document.getElementById('settingsPhotoWrap');
    if (agentData.photoUrl) {
      photoWrap.innerHTML = `<img src="${esc(agentData.photoUrl)}" class="photo-preview" id="settingsPhotoPreview" />`;
    } else {
      const ph = document.getElementById('settingsPhotoPlaceholder');
      if (ph) ph.textContent = (agentData.name||'A').slice(0,2).toUpperCase();
    }

    // Upload photo
    document.getElementById('uploadPhotoBtn').addEventListener('click', () => document.getElementById('photoInput').click());
    document.getElementById('photoInput').addEventListener('change', handlePhotoUpload);

    // Save profile
    document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);

    // Save skills
    document.getElementById('saveSkillsBtn').addEventListener('click', saveSkills);

    // Add skill on select
    document.getElementById('skillSelect').addEventListener('change', e => {
      const s = e.target.value; if (!s) return;
      if (agentSkills.length >= 20) { alert('Maximum 20 skills allowed.'); e.target.value=''; return; }
      if (!agentSkills.includes(s)) { agentSkills.push(s); renderSkillTags(); }
      e.target.value = '';
    });

    // Change password
    document.getElementById('savePwBtn').addEventListener('click', changePassword);
  }

  function populateSkillSelect() {
    const service = document.getElementById('settingsService').value;
    const sel = document.getElementById('skillSelect');
    const skills = SERVICES_SKILLS[service] || [];
    sel.innerHTML = '<option value="">— choose a skill —</option>' +
      skills.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  }

  function renderSkillTags() {
    const wrap = document.getElementById('skillsTagsWrap');
    wrap.innerHTML = agentSkills.map((s,i) =>
      `<div class="skill-tag-edit">${esc(s)}<button onclick="removeSkill(${i})">×</button></div>`
    ).join('') || '<p style="font-size:.8rem;color:#94a3b8">No skills added yet.</p>';
  }
  window.removeSkill = i => { agentSkills.splice(i,1); renderSkillTags(); };

  async function handlePhotoUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    const progress = document.getElementById('uploadProgress');
    const btn = document.getElementById('uploadPhotoBtn');
    progress.style.display = ''; progress.textContent = 'Uploading…';
    btn.disabled = true;
    try {
      const url = await uploadToCloudinary(file, 'agent-photos');
      await db.collection('agents').doc(agentData.docId).update({ photoUrl: url });
      agentData.photoUrl = url;
      const photoWrap = document.getElementById('settingsPhotoWrap');
      photoWrap.innerHTML = `<img src="${url}" class="photo-preview" />`;
      progress.textContent = '✓ Photo updated!';
      progress.style.color = '#16a34a';
      setTimeout(() => { progress.style.display='none'; progress.style.color=''; }, 3000);
      setSidebarAgent();
    } catch(err) {
      progress.textContent = 'Upload failed: ' + err.message;
      progress.style.color = '#ef4444';
    }
    btn.disabled = false;
    e.target.value = '';
  }

  async function saveProfile() {
    const btn = document.getElementById('saveProfileBtn');
    const succ = document.getElementById('profileSucc');
    const errEl = document.getElementById('profileErr');
    succ.style.display='none'; errEl.style.display='none';
    const name = document.getElementById('settingsName').value.trim();
    const bio = document.getElementById('settingsBio').value.trim();
    const service = document.getElementById('settingsService').value;
    if (!name) { errEl.textContent='Name is required.'; errEl.style.display=''; return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await db.collection('agents').doc(agentData.docId).update({ name, bio, service });
      agentData.name = name; agentData.bio = bio; agentData.service = service;
      setSidebarAgent(); populateSkillSelect();
      succ.style.display = ''; setTimeout(()=>succ.style.display='none',3000);
    } catch(e) { errEl.textContent = e.message; errEl.style.display=''; }
    btn.disabled = false; btn.textContent = 'Save Changes';
  }

  async function saveSkills() {
    const btn = document.getElementById('saveSkillsBtn');
    const succ = document.getElementById('skillsSucc');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await db.collection('agents').doc(agentData.docId).update({ skills: agentSkills });
      agentData.skills = agentSkills;
      succ.style.display=''; setTimeout(()=>succ.style.display='none',3000);
    } catch(e) { alert('Error: '+e.message); }
    btn.disabled = false; btn.textContent = 'Save Skills';
  }

  async function changePassword() {
    const newPw = document.getElementById('newPw').value;
    const confirm = document.getElementById('confirmPw').value;
    const btn = document.getElementById('savePwBtn');
    const succ = document.getElementById('pwSucc');
    const errEl = document.getElementById('pwErr');
    succ.style.display='none'; errEl.style.display='none';
    if (newPw.length < 8) { errEl.textContent='Password must be at least 8 characters.'; errEl.style.display=''; return; }
    if (newPw !== confirm) { errEl.textContent='Passwords do not match.'; errEl.style.display=''; return; }
    btn.disabled = true; btn.textContent = 'Updating…';
    try {
      await currentUser.updatePassword(newPw);
      document.getElementById('newPw').value = '';
      document.getElementById('confirmPw').value = '';
      succ.style.display=''; setTimeout(()=>succ.style.display='none',4000);
    } catch(e) {
      if (e.code === 'auth/requires-recent-login') {
        errEl.textContent = 'Please sign out and sign in again before changing your password.';
      } else {
        errEl.textContent = e.message;
      }
      errEl.style.display='';
    }
    btn.disabled = false; btn.textContent = 'Update Password';
  }

  // ---- SEARCH CONVS ----
  document.getElementById('convSearch').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const filtered = allConvs.filter(c => (c.userName||'').toLowerCase().includes(q) || (c.userEmail||'').toLowerCase().includes(q));
    renderConvList(filtered);
  });

  // ---- HELPERS ----
  function esc(str){ return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function escHtml(str){ return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }
})();
