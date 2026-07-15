/* =====================================================================
   DARAPET TECHNOLOGY — AGENT DASHBOARD
   Full profile management: conversations, profile, portfolio,
   education, languages, skills, password change.
   ===================================================================== */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════
     STATIC DATA
  ═══════════════════════════════════════════════════════ */
  const SERVICES = [
    'Web & App Development','Video Editing','Graphics & Design',
    'Digital Marketing','Email Marketing'
  ];

  const SERVICE_SKILLS = {
    'Web & App Development': ['HTML/CSS','JavaScript','TypeScript','React.js','Next.js','Vue.js','Nuxt.js','Node.js','PHP','Laravel','WordPress','Shopify','MySQL','PostgreSQL','MongoDB','Firebase','REST APIs','GraphQL','Git','Docker'],
    'Video Editing': ['Adobe Premiere Pro','Final Cut Pro','DaVinci Resolve','After Effects','CapCut','Motion Graphics','Color Grading','Sound Design','Subtitles/Captions','YouTube Optimisation','Video Ads','Podcast Editing'],
    'Graphics & Design': ['Adobe Photoshop','Adobe Illustrator','Figma','Canva','Logo Design','Brand Identity','UI/UX Design','Packaging Design','Print Design','Social Media Graphics','Pitch Decks','Infographics'],
    'Digital Marketing': ['SEO','Google Ads','Facebook Ads','TikTok Ads','Content Marketing','Social Media Strategy','Analytics (GA4)','Email Campaigns','Marketing Funnels','Copywriting','Influencer Marketing'],
    'Email Marketing': ['Mailchimp','Klaviyo','Brevo (Sendinblue)','HubSpot','ActiveCampaign','Email Copywriting','Automation Flows','List Segmentation','A/B Testing','HTML Emails','Lead Nurturing']
  };

  const ALL_SKILLS = [...new Set(Object.values(SERVICE_SKILLS).flat())].sort();

  const COUNTRIES = ['Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahrain','Bangladesh','Belarus','Belgium','Benin','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada','Cape Verde','Central African Republic','Chad','Chile','China','Colombia','Congo (DRC)','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Dominican Republic','Ecuador','Egypt','El Salvador','Ethiopia','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Guatemala','Guinea','Honduras','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Mauritania','Mauritius','Mexico','Moldova','Mongolia','Morocco','Mozambique','Myanmar','Namibia','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','Norway','Oman','Pakistan','Panama','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saudi Arabia','Senegal','Serbia','Sierra Leone','Singapore','Slovakia','Slovenia','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria','Tanzania','Thailand','Togo','Tunisia','Turkey','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'];

  const LANGUAGES = ['Afrikaans','Albanian','Amharic','Arabic','Armenian','Azerbaijani','Basque','Belarusian','Bengali','Bosnian','Bulgarian','Catalan','Chinese (Mandarin)','Chinese (Cantonese)','Croatian','Czech','Danish','Dutch','English','Estonian','Farsi','Filipino','Finnish','French','Galician','Georgian','German','Greek','Gujarati','Hausa','Hebrew','Hindi','Hungarian','Icelandic','Igbo','Indonesian','Italian','Japanese','Javanese','Kannada','Kazakh','Khmer','Korean','Kurdish','Kyrgyz','Lao','Latvian','Lithuanian','Macedonian','Malay','Malayalam','Maltese','Marathi','Mongolian','Myanmar/Burmese','Nepali','Norwegian','Oromo','Pashto','Polish','Portuguese','Punjabi','Romanian','Russian','Serbian','Sinhalese','Slovak','Slovenian','Somali','Spanish','Swahili','Swedish','Tagalog','Tajik','Tamil','Telugu','Thai','Turkish','Turkmen','Ukrainian','Urdu','Uzbek','Vietnamese','Welsh','Wolof','Xhosa','Yoruba','Zulu'];

  const DEGREE_OPTIONS = ['Primary School Certificate','BECE / Junior Secondary Certificate','WAEC / SSCE','OND','HND','Bachelor\'s Degree','Master\'s Degree','MBA','PhD / Doctorate','Professional Certification','Diploma','Associate Degree','Other'];
  const INSTITUTION_TYPES = ['Primary School','Secondary School','Polytechnic / Technical College','University','Online Platform / MOOC','Professional Body','Vocational/Trade School','Other'];

  /* ═══════════════════════════════════════════════════════
     STATE
  ═══════════════════════════════════════════════════════ */
  let agentUser   = null;  // Firebase Auth user
  let agentDoc    = null;  // Firestore agent document snapshot
  let agentData   = {};    // Firestore data
  let activeConvId= null;
  let msgListener = null;
  let convListener= null;
  let attachments = [];
  let agentSkills    = [];
  let agentLanguages = [];
  let agentPortfolio = [];
  let agentEducation = [];

  /* ═══════════════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════════════ */
  const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  function el(id) { return document.getElementById(id); }
  function fmtTime(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    if (diff < 604800000) return d.toLocaleDateString([],{weekday:'short'});
    return d.toLocaleDateString([],{day:'2-digit',month:'short'});
  }
  function fmtDay(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const today = new Date(); today.setHours(0,0,0,0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1);
    d.setHours(0,0,0,0);
    if (d.getTime()===today.getTime()) return 'Today';
    if (d.getTime()===yesterday.getTime()) return 'Yesterday';
    return d.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long'});
  }
  function initials(name) { return (name||'?').split(' ').map(w=>w[0]||'').slice(0,2).join('').toUpperCase(); }
  function showSucc(id, ms=2500) { const e=el(id); if(!e) return; e.style.display='block'; setTimeout(()=>e.style.display='none', ms); }
  function showErrEl(id, msg) { const e=el(id); if(!e) return; e.textContent=msg; e.style.display='block'; }
  function hideErrEl(id) { const e=el(id); if(e) e.style.display='none'; }
  function linkifyText(t) { return esc(t).replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" target="_blank" rel="noopener" class="msg-url-a">$1</a>'); }

  /* ═══════════════════════════════════════════════════════
     AUTH + ENTRY POINT
  ═══════════════════════════════════════════════════════ */
  auth.onAuthStateChanged(async user => {
    if (!user) { window.location.href = 'login.html'; return; }
    agentUser = user;
    try {
      const snap = await db.collection('agents').where('uid','==',user.uid).limit(1).get();
      if (snap.empty) { alert('No agent profile found. Contact admin.'); auth.signOut(); return; }
      agentDoc  = snap.docs[0];
      agentData = agentDoc.data();
      initDashboard();
    } catch(e) { console.error('Agent load failed:', e); alert('Error loading profile: '+e.message); }
  });

  /* ═══════════════════════════════════════════════════════
     INIT
  ═══════════════════════════════════════════════════════ */
  function initDashboard() {
    updateSidebar();
    setupNav();
    setupMobileToggle();
    setupSignOut();
    setupConversations();
    setupProfileTab();
    setupPortfolioTab();
    setupEducationTab();
    setupSettingsTab();
    // Handle first-login flag
    if (agentData.firstLogin) {
      db.collection('agents').doc(agentDoc.id).update({ firstLogin: false });
      showWelcomeToast(agentData.name || 'Agent');
    }
  }

  function updateSidebar() {
    el('sidebarName').textContent = agentData.displayName || agentData.name || 'Agent';
    el('sidebarService').textContent = agentData.service || '';
    const av = el('sidebarAvatar');
    if (agentData.photoUrl) {
      av.outerHTML = `<img id="sidebarAvatar" class="agent-av-ph" src="${esc(agentData.photoUrl)}" style="width:36px;height:36px;border-radius:10px;object-fit:cover" />`;
    } else {
      av.textContent = initials(agentData.name||agentData.displayName||'A');
    }
  }

  function showWelcomeToast(name) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1d4ed8;color:#fff;padding:14px 22px;border-radius:12px;font-size:.9rem;font-weight:600;z-index:999;box-shadow:0 8px 30px rgba(0,0,0,.25)';
    t.innerHTML = `<i class="fas fa-hand-wave"></i> Welcome, ${esc(name)}! Complete your profile to start getting clients.`;
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 5000);
  }

  /* ═══════════════════════════════════════════════════════
     NAV / TAB SWITCHING
  ═══════════════════════════════════════════════════════ */
  function setupNav() {
    const tabs = {
      chats: { nav:'navChats', tab:'tabChats' },
      profile: { nav:'navProfile', tab:'tabProfile', init: loadProfileData },
      portfolio: { nav:'navPortfolio', tab:'tabPortfolio', init: loadPortfolioData },
      education: { nav:'navEducation', tab:'tabEducation', init: loadEducationData },
      settings: { nav:'navSettings', tab:'tabSettings', init: loadSettingsData },
    };
    const chatsTabs  = ['tabChats'];
    const areaTabs   = ['tabProfile','tabPortfolio','tabEducation','tabSettings'];
    const convsPanel = el('convsPanel');

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const key = item.dataset.tab;
        if (!key || !tabs[key]) return;
        document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
        item.classList.add('active');
        el('tabChats').style.display = 'none';
        areaTabs.forEach(t => { const e=el(t); if(e) e.classList.remove('visible'); });
        if (key === 'chats') {
          el('tabChats').style.display = 'flex';
        } else {
          const t = el(tabs[key].tab);
          if (t) { t.classList.add('visible'); if (tabs[key].init) tabs[key].init(); }
        }
        // close sidebar on mobile
        el('sidebar').classList.remove('open');
        el('sidebarOverlay').classList.remove('open');
      });
    });
  }

  function setupMobileToggle() {
    el('mobileMenuToggle').addEventListener('click', () => {
      el('sidebar').classList.add('open');
      el('sidebarOverlay').classList.add('open');
    });
    el('sidebarOverlay').addEventListener('click', () => {
      el('sidebar').classList.remove('open');
      el('sidebarOverlay').classList.remove('open');
    });
    // Convs toggle
    el('convsToggle').addEventListener('click', () => {
      el('convsPanel').classList.add('open');
      el('convsOverlay').classList.add('open');
    });
    el('convsOverlay').addEventListener('click', () => {
      el('convsPanel').classList.remove('open');
      el('convsOverlay').classList.remove('open');
    });
  }

  function setupSignOut() {
    el('signOutBtn').addEventListener('click', () => {
      auth.signOut().then(() => window.location.href='login.html');
    });
  }

  /* ═══════════════════════════════════════════════════════
     CONVERSATIONS
  ═══════════════════════════════════════════════════════ */
  function setupConversations() {
    if (!agentDoc) return;
    el('convSearch').addEventListener('input', function() {
      const q = this.value.toLowerCase();
      document.querySelectorAll('.conv-item').forEach(item => {
        item.style.display = item.dataset.name.toLowerCase().includes(q) ? '' : 'none';
      });
    });
    loadConversations();
  }

  function loadConversations() {
    const list = el('convsList');
    if (convListener) convListener();
    convListener = db.collection('conversations')
      .where('agentId','==',agentDoc.id)
      .orderBy('lastMessageTime','desc')
      .onSnapshot(snap => {
        if (snap.empty) { list.innerHTML = '<div class="convs-empty">No conversations yet.</div>'; return; }
        let count = 0;
        list.innerHTML = snap.docs.map(doc => {
          const c = doc.data();
          const unread = (c.unreadAgent || 0);
          count += unread > 0 ? 1 : 0;
          const av = (c.customerName||'U').charAt(0).toUpperCase();
          const time = fmtTime(c.lastMessageTime);
          const active = doc.id === activeConvId ? 'active' : '';
          return `<div class="conv-item ${active}" id="conv-item-${doc.id}" data-id="${doc.id}" data-name="${esc(c.customerName||'')}">
            <div class="conv-av">${esc(av)}</div>
            <div class="conv-info">
              <div class="conv-name">${esc(c.customerName||'Unknown')}</div>
              <div class="conv-preview">${esc(c.lastMessage||'')}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
              <div class="conv-time">${esc(time)}</div>
              ${unread>0?`<div class="conv-unread" title="${unread} unread"></div>`:''}
            </div>
          </div>`;
        }).join('');
        // Update unread badge
        const badge = el('unreadCount');
        if (badge) { if (count>0){badge.textContent=count;badge.style.display='inline';}else{badge.style.display='none';} }
        // Re-attach click listeners
        snap.docs.forEach(doc => {
          const item = el('conv-item-' + doc.id);
          if (item) item.addEventListener('click', () => openConversation(doc.id, doc.data()));
        });
      }, err => {
        list.innerHTML = `<div class="convs-empty" style="color:#ef4444">Error: ${esc(err.message)}</div>`;
      });
  }

  async function openConversation(convId, convData) {
    activeConvId = convId;
    document.querySelectorAll('.conv-item').forEach(i=>i.classList.remove('active'));
    const item = el('conv-item-'+convId);
    if (item) item.classList.add('active');
    // Mark messages as read
    db.collection('conversations').doc(convId).update({ unreadAgent: 0 }).catch(()=>{});
    // Close mobile panel
    el('convsPanel').classList.remove('open');
    el('convsOverlay').classList.remove('open');
    renderChatHeader(convData);
    renderChatInput(convId);
    loadMessages(convId);
  }

  function renderChatHeader(c) {
    const av = (c.customerName||'U').charAt(0).toUpperCase();
    el('chatArea').innerHTML = `
      <div class="chat-header-bar">
        <div class="chat-header-av">${esc(av)}</div>
        <div class="chat-header-info">
          <div class="chat-header-name">${esc(c.customerName||'Customer')}</div>
          <div class="chat-header-meta">${esc(c.customerEmail||'')} · ${esc(c.projectService||c.service||'')}</div>
        </div>
      </div>
      <div class="messages-wrap" id="messagesWrap"></div>
      <div class="input-bar" id="inputBar"></div>`;
  }

  function loadMessages(convId) {
    if (msgListener) msgListener();
    msgListener = db.collection('conversations').doc(convId).collection('messages')
      .orderBy('timestamp','asc')
      .onSnapshot(snap => {
        const wrap = el('messagesWrap');
        if (!wrap) return;
        let html = '', lastDay = '';
        snap.docs.forEach(doc => {
          const m = doc.data();
          const dayLabel = fmtDay(m.timestamp);
          if (dayLabel !== lastDay) {
            html += `<div class="day-sep">${esc(dayLabel)}</div>`;
            lastDay = dayLabel;
          }
          const isAgent = (m.senderType==='agent');
          html += buildBubble(m, isAgent);
        });
        wrap.innerHTML = html || '<div style="text-align:center;color:#94a3b8;font-size:.84rem;padding:20px">No messages yet. Start the conversation!</div>';
        wrap.scrollTop = wrap.scrollHeight;
        // Attach image preview handlers
        wrap.querySelectorAll('.msg-img').forEach(img => {
          img.addEventListener('click', () => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
            overlay.innerHTML = `<img src="${img.src}" style="max-width:90vw;max-height:90vh;border-radius:10px" />`;
            overlay.addEventListener('click', ()=>overlay.remove());
            document.body.appendChild(overlay);
          });
        });
      });
  }

  function buildBubble(m, isAgent) {
    const side = isAgent ? 'mine' : 'theirs';
    const time = fmtTime(m.timestamp);
    let content = '';
    if (m.type==='image' && m.fileUrl) {
      content = `<img src="${esc(m.fileUrl)}" class="msg-img" alt="image" />`;
    } else if (m.type==='file' && m.fileUrl) {
      content = `<a href="${esc(m.fileUrl)}" target="_blank" class="msg-file-a"><i class="fas fa-file"></i><span>${esc(m.fileName||'File')}</span></a>`;
    } else {
      content = `<div>${linkifyText(m.text||'')}</div>`;
    }
    const avPh = `<div class="msg-av-a-ph">${initials(isAgent ? (agentData.displayName||agentData.name||'A') : 'C')}</div>`;
    const av = isAgent && agentData.photoUrl
      ? `<img class="msg-av-a" src="${esc(agentData.photoUrl)}" />`
      : avPh;
    return `<div class="msg-row ${side}">
      ${av}
      <div>
        <div class="bubble">${content}</div>
        <div class="msg-time">${esc(time)}</div>
      </div>
    </div>`;
  }

  function renderChatInput(convId) {
    const bar = el('inputBar');
    if (!bar) return;
    bar.innerHTML = `
      <div class="attach-row" id="attachRow"></div>
      <div class="input-row-a">
        <button class="att-btn" id="attachImgBtn" title="Send image"><i class="fas fa-image"></i></button>
        <button class="att-btn" id="attachFileBtn" title="Send file"><i class="fas fa-paperclip"></i></button>
        <textarea class="msg-ta" id="msgInput" placeholder="Type a message…" rows="1"></textarea>
        <button class="snd-btn" id="sendMsgBtn"><i class="fas fa-paper-plane"></i></button>
      </div>`;
    attachments = [];
    el('attachImgBtn').addEventListener('click', () => el('chatImageInput').click());
    el('attachFileBtn').addEventListener('click', () => el('chatFileInput').click());
    el('chatImageInput').addEventListener('change', e => handleAttachment(e, 'image'));
    el('chatFileInput').addEventListener('change', e => handleAttachment(e, 'file'));
    el('msgInput').addEventListener('keydown', e => {
      if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(convId); }
    });
    el('msgInput').addEventListener('input', function() {
      this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,120)+'px';
    });
    el('sendMsgBtn').addEventListener('click', () => sendMessage(convId));
  }

  function handleAttachment(e, type) {
    const file = e.target.files[0]; if(!file) return;
    if (file.size > 15*1024*1024) { alert('Max file size is 15MB.'); return; }
    attachments.push({ file, type });
    const row = el('attachRow');
    row.classList.add('has-items');
    const idx = attachments.length - 1;
    if (type==='image') {
      const reader = new FileReader();
      reader.onload = ev => {
        const div = document.createElement('div');
        div.className='a-prev'; div.dataset.idx=idx;
        div.innerHTML=`<img src="${ev.target.result}"><button class="rm" onclick="removeAttachment(${idx})">&times;</button>`;
        row.appendChild(div);
      };
      reader.readAsDataURL(file);
    } else {
      const div = document.createElement('div');
      div.className='a-file-badge'; div.dataset.idx=idx;
      div.innerHTML=`<i class="fas fa-file" style="font-size:.7rem"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px">${esc(file.name)}</span><button class="rm" onclick="removeAttachment(${idx})">&times;</button>`;
      row.appendChild(div);
    }
    e.target.value='';
  }

  window.removeAttachment = function(idx) {
    attachments[idx] = null;
    const row = el('attachRow');
    const el2 = row.querySelector(`[data-idx="${idx}"]`);
    if (el2) el2.remove();
    if (!attachments.filter(Boolean).length) row.classList.remove('has-items');
  };

  async function sendMessage(convId) {
    const inp = el('msgInput');
    const text = inp.value.trim();
    const pendingAtt = attachments.filter(Boolean);
    if (!text && !pendingAtt.length) return;
    const btn = el('sendMsgBtn');
    btn.disabled = true;
    const ts = firebase.firestore.FieldValue.serverTimestamp();

    try {
      // Send attachments first
      for (const att of pendingAtt) {
        const url = await uploadChatFile(att.file);
        await db.collection('conversations').doc(convId).collection('messages').add({
          type: att.type, fileUrl: url, fileName: att.file.name,
          senderType: 'agent', senderId: agentUser.uid, timestamp: ts
        });
      }
      // Send text
      if (text) {
        await db.collection('conversations').doc(convId).collection('messages').add({
          type:'text', text, senderType:'agent', senderId:agentUser.uid, timestamp:ts
        });
      }
      await db.collection('conversations').doc(convId).update({
        lastMessage: text || (pendingAtt[0]?.type==='image'?'📷 Photo':'📎 File'),
        lastMessageTime: ts, unreadCustomer: firebase.firestore.FieldValue.increment(1)
      });
      inp.value=''; inp.style.height='auto';
      attachments=[];
      const row=el('attachRow');
      if(row){row.innerHTML='';row.classList.remove('has-items');}
    } catch(e) { alert('Send failed: '+e.message); }
    btn.disabled = false;
  }

  async function uploadChatFile(file) {
    const cfgDoc = await db.collection('settings').doc('cloudinary').get();
    if (!cfgDoc.exists) throw new Error('Cloudinary not configured.');
    const {cloudName, uploadPreset} = cfgDoc.data();
    const fd = new FormData();
    fd.append('file', file); fd.append('upload_preset', uploadPreset); fd.append('folder','chat-uploads');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,{method:'POST',body:fd});
    const data = await res.json();
    if (!data.secure_url) throw new Error(data.error?.message||'Upload failed');
    return data.secure_url;
  }

  /* ═══════════════════════════════════════════════════════
     MY PROFILE TAB
  ═══════════════════════════════════════════════════════ */
  function setupProfileTab() {
    // Populate country dropdown
    const countrySelect = el('profileCountry');
    COUNTRIES.forEach(c => countrySelect.appendChild(new Option(c,c)));

    // Populate service select
    const svcSelect = el('profileService');
    svcSelect.appendChild(new Option('— Select service —',''));
    SERVICES.forEach(s => { const opt=new Option(s,s); if(s===agentData.service)opt.selected=true; svcSelect.appendChild(opt); });

    // Photo upload
    el('uploadProfilePhotoBtn').addEventListener('click', ()=>el('profilePhotoInput').click());
    el('profilePhotoInput').addEventListener('change', async function(e) {
      const file = e.target.files[0]; if(!file) return;
      if (file.size > 5*1024*1024) { alert('Max 5MB.'); return; }
      el('profilePhotoProgress').style.display='block';
      el('profilePhotoProgress').textContent='Uploading…';
      try {
        const url = await uploadChatFile(file);
        await db.collection('agents').doc(agentDoc.id).update({ photoUrl: url });
        agentData.photoUrl = url;
        renderProfilePhoto(url);
        el('profilePhotoProgress').textContent='✓ Photo updated';
        setTimeout(()=>el('profilePhotoProgress').style.display='none',2500);
        updateSidebar();
      } catch(err) { el('profilePhotoProgress').textContent='Error: '+err.message; }
      e.target.value='';
    });

    // Save basic info
    el('saveBasicInfoBtn').addEventListener('click', async ()=>{
      const btn = el('saveBasicInfoBtn');
      btn.disabled=true; btn.textContent='Saving…';
      hideErrEl('basicInfoErr');
      try {
        const updates = {
          displayName: el('profileDisplayName').value.trim() || agentData.displayName,
          country: el('profileCountry').value,
          bio: el('profileBio').value.trim(),
          serviceDesc: el('profileServiceDesc').value.trim(),
          service: el('profileService').value || agentData.service
        };
        await db.collection('agents').doc(agentDoc.id).update(updates);
        Object.assign(agentData, updates);
        updateSidebar();
        showSucc('basicInfoSucc');
      } catch(e) { showErrEl('basicInfoErr', e.message); }
      btn.disabled=false; btn.textContent='Save Profile';
    });

    // Save private info
    el('savePrivateInfoBtn').addEventListener('click', async ()=>{
      const btn = el('savePrivateInfoBtn');
      btn.disabled=true; btn.textContent='Saving…';
      hideErrEl('privateInfoErr');
      try {
        const updates = { phone: el('profilePhone').value.trim(), dob: el('profileDob').value };
        await db.collection('agents').doc(agentDoc.id).update(updates);
        Object.assign(agentData, updates);
        showSucc('privateInfoSucc');
      } catch(e) { showErrEl('privateInfoErr', e.message); }
      btn.disabled=false; btn.textContent='Save Private Info';
    });
  }

  function renderProfilePhoto(url) {
    const wrap = el('profilePhotoWrap');
    if (url) {
      wrap.innerHTML = `<img src="${esc(url)}" class="photo-preview" style="width:76px;height:76px;border-radius:14px;object-fit:cover;border:2px solid #bfdbfe" />`;
    } else {
      wrap.innerHTML = `<div class="photo-preview-ph" id="profilePhotoPh">${initials(agentData.name||agentData.displayName||'A')}</div>`;
    }
  }

  let profileLoaded = false;
  function loadProfileData() {
    if (profileLoaded) return; profileLoaded = true;
    el('profileDisplayName').value = agentData.displayName || '';
    el('profileBio').value          = agentData.bio || '';
    el('profileServiceDesc').value  = agentData.serviceDesc || '';
    el('profilePhone').value        = agentData.phone || '';
    el('profileDob').value          = agentData.dob || '';
    if (agentData.country) el('profileCountry').value = agentData.country;
    if (agentData.service)  el('profileService').value  = agentData.service;
    renderProfilePhoto(agentData.photoUrl);
  }

  /* ═══════════════════════════════════════════════════════
     PORTFOLIO TAB
  ═══════════════════════════════════════════════════════ */
  function setupPortfolioTab() {
    el('addPortfolioBtn').addEventListener('click', () => openPortfolioModal(null));
  }

  let portfolioLoaded = false;
  function loadPortfolioData() {
    if (portfolioLoaded) { renderPortfolioList(); return; }
    portfolioLoaded = true;
    agentPortfolio = agentData.portfolio ? [...agentData.portfolio] : [];
    renderPortfolioList();
  }

  function renderPortfolioList() {
    const list = el('portfolioList');
    if (!agentPortfolio.length) {
      list.innerHTML = '<div style="color:#94a3b8;font-size:.85rem;padding:16px 0;margin-bottom:10px">No portfolio items yet. Add your best work!</div>';
      return;
    }
    list.innerHTML = agentPortfolio.map((p,i) => {
      const imgEl = p.imageUrl
        ? `<img src="${esc(p.imageUrl)}" class="portfolio-card-thumb" />`
        : `<div class="portfolio-card-thumb-ph"><i class="fas fa-briefcase"></i></div>`;
      const period = [p.startDate, p.endDate].filter(Boolean).join(' – ') || '';
      return `<div class="portfolio-card">
        <div class="portfolio-card-header">
          ${imgEl}
          <div class="portfolio-card-meta">
            <div class="portfolio-card-title">${esc(p.title||'Untitled')}</div>
            <div class="portfolio-card-company">${esc(p.company||'')}</div>
            ${period?`<div class="portfolio-card-period">${esc(period)}</div>`:''}
          </div>
        </div>
        ${p.description?`<div class="portfolio-card-desc">${esc(p.description)}</div>`:''}
        <div class="portfolio-card-actions">
          ${p.url?`<button class="pf-action-btn" onclick="window.open('${esc(p.url)}','_blank')"><i class="fas fa-external-link-alt"></i> View Live</button>`:''}
          <button class="pf-action-btn" onclick="editPortfolio(${i})"><i class="fas fa-pencil-alt"></i> Edit</button>
          <button class="pf-action-btn del" onclick="deletePortfolio(${i})"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>`;
    }).join('');
  }

  window.editPortfolio   = i => openPortfolioModal(i);
  window.deletePortfolio = async i => {
    if (!confirm('Delete this portfolio item?')) return;
    agentPortfolio.splice(i,1);
    await savePortfolio();
    renderPortfolioList();
  };

  function openPortfolioModal(editIdx) {
    const item = editIdx !== null ? agentPortfolio[editIdx] : null;
    const modal = el('modalBox');
    modal.innerHTML = `
      <div class="modal-header">
        <h3>${item ? 'Edit Portfolio Item' : 'Add Portfolio Item'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="field-s"><label>Project Title *</label><input type="text" id="pfTitle" value="${esc(item?.title||'')}" placeholder="e.g. Brand identity for TechCorp" /></div>
      <div class="field-s"><label>Company / Client Name</label><input type="text" id="pfCompany" value="${esc(item?.company||'')}" placeholder="Client or project name" /></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field-s"><label>Start Date</label><input type="month" id="pfStart" value="${esc(item?.startDate||'')}" /></div>
        <div class="field-s"><label>End Date</label><input type="month" id="pfEnd" value="${esc(item?.endDate||'')}" /></div>
      </div>
      <div class="field-s"><label>Description</label><textarea id="pfDesc" rows="3" placeholder="Describe what you built or achieved…">${esc(item?.description||'')}</textarea></div>
      <div class="field-s"><label>Live URL <span style="color:#94a3b8;font-weight:400">(optional)</span></label><input type="url" id="pfUrl" value="${esc(item?.url||'')}" placeholder="https://example.com" /></div>
      <div class="field-s">
        <label>Project Image <span style="color:#94a3b8;font-weight:400">(max 5MB)</span></label>
        ${item?.imageUrl ? `<img src="${esc(item.imageUrl)}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin-bottom:8px;border:1px solid #e2e8f0" id="pfImgPreview" />` : '<div id="pfImgPreview"></div>'}
        <button class="upload-photo-btn" id="pfImgBtn"><i class="fas fa-upload"></i> Upload Image</button>
        <input type="file" id="pfImgInput" accept="image/*" style="display:none" />
        <div id="pfImgProgress" style="font-size:.74rem;color:#1d4ed8;margin-top:4px;display:none">Uploading…</div>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn-primary save-btn" id="pfSaveBtn" style="flex:none">${item ? 'Save Changes' : 'Add Item'}</button>
      </div>`;

    let uploadedImg = item?.imageUrl || '';
    el('pfImgBtn').addEventListener('click', ()=>el('pfImgInput').click());
    el('pfImgInput').addEventListener('change', async function(e) {
      const file=e.target.files[0]; if(!file) return;
      if(file.size>5*1024*1024){alert('Max 5MB.');return;}
      el('pfImgProgress').style.display='block'; el('pfImgProgress').textContent='Uploading…';
      try {
        uploadedImg = await uploadPortfolioImage(file);
        el('pfImgPreview').outerHTML=`<img src="${esc(uploadedImg)}" style="width:100%;max-height:140px;object-fit:cover;border-radius:8px;margin-bottom:8px;border:1px solid #e2e8f0" id="pfImgPreview" />`;
        el('pfImgProgress').textContent='✓ Uploaded';
      } catch(err){el('pfImgProgress').textContent='Error: '+err.message;}
      e.target.value='';
    });

    el('pfSaveBtn').addEventListener('click', async ()=>{
      const title = el('pfTitle').value.trim();
      if (!title) { alert('Please enter a project title.'); return; }
      const entry = {
        title, company: el('pfCompany').value.trim(),
        startDate: el('pfStart').value, endDate: el('pfEnd').value,
        description: el('pfDesc').value.trim(),
        url: el('pfUrl').value.trim(), imageUrl: uploadedImg
      };
      if (editIdx !== null) agentPortfolio[editIdx] = entry;
      else agentPortfolio.push(entry);
      await savePortfolio();
      closeModal();
      renderPortfolioList();
    });

    el('modalOverlay').style.display = 'flex';
    el('modalOverlay').onclick = e => { if(e.target===el('modalOverlay')) closeModal(); };
  }

  async function uploadPortfolioImage(file) {
    const cfgDoc = await db.collection('settings').doc('cloudinary').get();
    if (!cfgDoc.exists) throw new Error('Cloudinary not configured');
    const {cloudName,uploadPreset}=cfgDoc.data();
    const fd=new FormData(); fd.append('file',file); fd.append('upload_preset',uploadPreset); fd.append('folder','agent-portfolio');
    const res=await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,{method:'POST',body:fd});
    const data=await res.json();
    if(!data.secure_url)throw new Error(data.error?.message||'Upload failed');
    return data.secure_url;
  }

  async function savePortfolio() {
    await db.collection('agents').doc(agentDoc.id).update({ portfolio: agentPortfolio });
    agentData.portfolio = agentPortfolio;
  }

  window.closeModal = () => { el('modalOverlay').style.display='none'; };

  /* ═══════════════════════════════════════════════════════
     EDUCATION TAB
  ═══════════════════════════════════════════════════════ */
  function setupEducationTab() {
    el('addEducationBtn').addEventListener('click', ()=>openEducationModal(null));
    // Populate language select
    const lSelect = el('languageSelect');
    LANGUAGES.forEach(l => lSelect.appendChild(new Option(l,l)));
    el('languageSelect').addEventListener('change', function() {
      if (!this.value) return;
      addLanguageChip(this.value);
      this.value = '';
    });
    el('saveLanguagesBtn').addEventListener('click', saveLanguages);
  }

  let educationLoaded = false;
  function loadEducationData() {
    if (educationLoaded) { renderEducationList(); renderLangChips(); return; }
    educationLoaded = true;
    agentEducation = agentData.education ? [...agentData.education] : [];
    agentLanguages = agentData.languages ? [...agentData.languages] : [];
    renderEducationList();
    renderLangChips();
  }

  function renderEducationList() {
    const list = el('educationList');
    if (!agentEducation.length) {
      list.innerHTML='<div style="color:#94a3b8;font-size:.84rem;margin-bottom:10px">No education added yet.</div>';
      return;
    }
    list.innerHTML = agentEducation.map((e,i)=>`
      <div class="portfolio-card" style="padding:14px 18px">
        <div style="display:flex;align-items:flex-start;gap:12px">
          <div style="width:40px;height:40px;border-radius:10px;background:#eff6ff;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="fas fa-graduation-cap" style="color:#1d4ed8"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:.88rem;color:#0f172a">${esc(e.degree||'—')}</div>
            <div style="font-size:.78rem;color:#3b82f6;font-weight:600">${esc(e.school||'—')}</div>
            <div style="font-size:.74rem;color:#94a3b8">${esc(e.institutionType||'')}${e.year?' · '+esc(e.year):''}</div>
            ${e.course?`<div style="font-size:.76rem;color:#64748b;margin-top:2px">${esc(e.course)}</div>`:''}
          </div>
          <div style="display:flex;gap:5px">
            <button class="pf-action-btn" style="padding:4px 10px" onclick="editEducation(${i})"><i class="fas fa-pencil-alt"></i></button>
            <button class="pf-action-btn del" style="padding:4px 10px" onclick="deleteEducation(${i})"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      </div>`).join('');
  }

  window.editEducation   = i => openEducationModal(i);
  window.deleteEducation = async i => {
    if (!confirm('Delete this education entry?')) return;
    agentEducation.splice(i,1);
    await saveEducation();
    renderEducationList();
  };

  function openEducationModal(editIdx) {
    const item = editIdx!==null ? agentEducation[editIdx] : null;
    const modal = el('modalBox');
    modal.innerHTML = `
      <div class="modal-header">
        <h3>${item?'Edit Education':'Add Education'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="field-s"><label>Degree / Certificate / Grade *</label>
        <select id="eduDegree">
          <option value="">— Select —</option>
          ${DEGREE_OPTIONS.map(d=>`<option value="${esc(d)}" ${item?.degree===d?'selected':''}>${esc(d)}</option>`).join('')}
        </select>
      </div>
      <div class="field-s"><label>School / Institution *</label><input type="text" id="eduSchool" value="${esc(item?.school||'')}" placeholder="e.g. University of Lagos" /></div>
      <div class="field-s"><label>Institution Type</label>
        <select id="eduInstitutionType">
          <option value="">— Select —</option>
          ${INSTITUTION_TYPES.map(t=>`<option value="${esc(t)}" ${item?.institutionType===t?'selected':''}>${esc(t)}</option>`).join('')}
        </select>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field-s"><label>Year Completed</label><input type="number" id="eduYear" value="${esc(item?.year||'')}" placeholder="e.g. 2022" min="1960" max="2030" /></div>
        <div class="field-s"><label>Course Studied</label><input type="text" id="eduCourse" value="${esc(item?.course||'')}" placeholder="e.g. Computer Science" /></div>
      </div>
      <div class="modal-actions">
        <button class="btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="save-btn" id="eduSaveBtn" style="padding:9px 22px">${item?'Save Changes':'Add Entry'}</button>
      </div>`;
    el('eduSaveBtn').addEventListener('click', async ()=>{
      const degree = el('eduDegree').value;
      const school = el('eduSchool').value.trim();
      if(!degree||!school){alert('Please fill in degree and school name.');return;}
      const entry={degree,school,institutionType:el('eduInstitutionType').value,year:el('eduYear').value,course:el('eduCourse').value.trim()};
      if(editIdx!==null)agentEducation[editIdx]=entry; else agentEducation.push(entry);
      await saveEducation();
      closeModal(); renderEducationList();
    });
    el('modalOverlay').style.display='flex';
    el('modalOverlay').onclick=e=>{if(e.target===el('modalOverlay'))closeModal();};
  }

  async function saveEducation() {
    await db.collection('agents').doc(agentDoc.id).update({ education: agentEducation });
    agentData.education = agentEducation;
  }

  /* ── Languages ── */
  function addLanguageChip(lang) {
    if (agentLanguages.includes(lang)) return;
    agentLanguages.push(lang);
    renderLangChips();
  }

  function renderLangChips() {
    const wrap = el('langChipsWrap');
    wrap.innerHTML = agentLanguages.map(l=>`
      <div class="lang-chip">
        ${esc(l)}
        <button title="Remove" onclick="removeLang('${esc(l)}')">&times;</button>
      </div>`).join('');
  }

  window.removeLang = l => {
    agentLanguages = agentLanguages.filter(x=>x!==l);
    renderLangChips();
  };

  async function saveLanguages() {
    const btn = el('saveLanguagesBtn');
    btn.disabled=true; btn.textContent='Saving…';
    try {
      await db.collection('agents').doc(agentDoc.id).update({ languages: agentLanguages });
      agentData.languages = agentLanguages;
      showSucc('langSucc');
    } catch(e) { alert('Save failed: '+e.message); }
    btn.disabled=false; btn.textContent='Save Languages';
  }

  /* ═══════════════════════════════════════════════════════
     SETTINGS TAB (Skills + Password)
  ═══════════════════════════════════════════════════════ */
  function setupSettingsTab() {
    // Populate skill select
    const ss = el('skillSelect');
    ALL_SKILLS.forEach(s => ss.appendChild(new Option(s,s)));
    ss.addEventListener('change', function(){
      if(!this.value)return;
      if(agentSkills.length>=20){alert('Max 20 skills.');this.value='';return;}
      if(!agentSkills.includes(this.value))agentSkills.push(this.value);
      renderSkillTags();
      this.value='';
    });
    el('saveSkillsBtn').addEventListener('click', saveSkills);

    // Password
    el('savePwBtn').addEventListener('click', async ()=>{
      const pw  = el('newPw').value;
      const cpw = el('confirmPw').value;
      hideErrEl('pwErr');
      if(pw.length<8){showErrEl('pwErr','Password must be at least 8 characters.');return;}
      if(pw!==cpw){showErrEl('pwErr','Passwords do not match.');return;}
      const btn=el('savePwBtn'); btn.disabled=true; btn.textContent='Updating…';
      try {
        await agentUser.updatePassword(pw);
        el('newPw').value=''; el('confirmPw').value='';
        showSucc('pwSucc');
      } catch(e){
        if(e.code==='auth/requires-recent-login'){showErrEl('pwErr','Please sign out and sign back in to change your password.');}
        else showErrEl('pwErr', e.message);
      }
      btn.disabled=false; btn.textContent='Update Password';
    });
  }

  let settingsLoaded = false;
  function loadSettingsData() {
    if (settingsLoaded) return; settingsLoaded = true;
    agentSkills = agentData.skills ? [...agentData.skills] : [];
    renderSkillTags();
  }

  function renderSkillTags() {
    const wrap = el('skillsTagsWrap');
    wrap.innerHTML = agentSkills.map(s=>`
      <div class="skill-tag-edit">
        ${esc(s)}
        <button title="Remove" onclick="removeSkill('${esc(s)}')">&times;</button>
      </div>`).join('');
  }

  window.removeSkill = s => {
    agentSkills = agentSkills.filter(x=>x!==s);
    renderSkillTags();
  };

  async function saveSkills() {
    const btn=el('saveSkillsBtn'); btn.disabled=true; btn.textContent='Saving…';
    try {
      await db.collection('agents').doc(agentDoc.id).update({ skills: agentSkills });
      agentData.skills = agentSkills;
      showSucc('skillsSucc');
    } catch(e){alert('Save failed: '+e.message);}
    btn.disabled=false; btn.textContent='Save Skills';
  }

})();
