/* =========================================
   DARAPET TECHNOLOGY — USER CHAT JS
   Agent cards + real-time chat with experts
   ========================================= */
(function () {
  'use strict';

  const storage = firebase.storage();
  const TS = () => firebase.firestore.FieldValue.serverTimestamp();

  const SERVICES_SKILLS = {
    'Web & App Development': ['Website Development','WordPress','Shopify','Mobile App Development','React.js','Vue.js','Node.js','PHP','MySQL','PostgreSQL','REST API','GraphQL','UI/UX Design','Figma','HTML/CSS','JavaScript','TypeScript','Git','Docker','AWS'],
    'Video Editing': ['Adobe Premiere Pro','After Effects','DaVinci Resolve','Motion Graphics','Color Grading','Sound Design','YouTube Videos','Short-Form/Reels','Corporate Videos','2D Animation','Subtitles & Captions','Thumbnail Design','VFX','Transitions','4K Editing','Audio Mixing','Storyboarding','Green Screen','Drone Footage','Brand Videos'],
    'Graphics & Design': ['Adobe Illustrator','Photoshop','InDesign','Figma','Logo Design','Brand Identity','UI/UX Design','Social Media Graphics','Print Design','Typography','Packaging Design','Infographics','Pitch Decks','Icon Design','Illustrations','Mockups','Banner Design','Email Templates','Business Cards','Poster Design'],
    'Digital Marketing': ['SEO','Google Ads','Facebook Ads','Instagram Ads','TikTok Ads','Email Campaigns','Content Strategy','Social Media Management','Analytics','Conversion Optimization','Copywriting','Keyword Research','Link Building','YouTube SEO','Influencer Outreach','A/B Testing','Landing Pages','Marketing Funnels','Brand Awareness','Competitor Analysis'],
    'Email Marketing': ['Mailchimp','Brevo/Sendinblue','Klaviyo','Campaign Monitor','Email Design','List Segmentation','Automation Flows','A/B Testing','Newsletter Design','Drip Campaigns','Lead Nurturing','Email Analytics','Subscriber Growth','Deliverability','GDPR Compliance','Welcome Sequences','Re-engagement Campaigns','Transactional Emails','Template Design','CRM Integration']
  };

  let currentUser = null;
  let allAgents = [];
  let selectedAgent = null;
  let currentConvId = null;
  let msgUnsubscribe = null;
  let pendingAttachments = []; // {type:'image'|'file', file, previewUrl}

  // ---- AUTH STATE ----
  auth.onAuthStateChanged(user => {
    currentUser = user;
    if (user) {
      // Check if this is an agent — redirect to their dashboard
      db.collection('agents').where('uid','==',user.uid).limit(1).get().then(snap => {
        if (!snap.empty) { window.location = 'agent-dashboard.html'; return; }
        showAuthUser(user);
      }).catch(() => showAuthUser(user));
    } else {
      showAuthGuest();
    }
  });

  function showAuthUser(user) {
    document.getElementById('topbarUser').style.display = 'flex';
    document.getElementById('topbarAuth').style.display = 'none';
    const initials = (user.displayName||user.email||'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userName').textContent = user.displayName || user.email;
    document.getElementById('signOutBtn').onclick = () => auth.signOut();
  }

  function showAuthGuest() {
    document.getElementById('topbarUser').style.display = 'none';
    document.getElementById('topbarAuth').style.display = 'flex';
  }

  // ---- LOAD AGENTS ----
  async function loadAgents() {
    try {
      const snap = await db.collection('agents').where('active','==',true).get();
      allAgents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAgentCards(allAgents);
    } catch(e) {
      document.getElementById('agentsList').innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8;font-size:.85rem">Could not load agents. Please try again.</div>';
    }
  }

  function renderAgentCards(agents) {
    const list = document.getElementById('agentsList');
    if (!agents.length) {
      list.innerHTML = '<div style="padding:32px 20px;text-align:center;color:#94a3b8;font-size:.85rem">No experts available right now.</div>';
      return;
    }
    list.innerHTML = agents.map(a => agentCardHTML(a)).join('');
    list.querySelectorAll('.agent-card').forEach(card => {
      card.addEventListener('click', () => {
        const agentId = card.dataset.agentId;
        const agent = allAgents.find(a => a.id === agentId);
        if (!agent) return;
        onAgentSelected(agent, card);
      });
    });
    list.querySelectorAll('.view-profile-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const agentId = btn.dataset.agentId;
        const agent = allAgents.find(a => a.id === agentId);
        if (agent) showAgentModal(agent);
      });
    });
  }

  function agentCardHTML(a) {
    const skills = (a.skills || []).slice(0, 6);
    const extra  = (a.skills || []).length - skills.length;
    const photoEl = a.photoUrl
      ? `<img src="${esc(a.photoUrl)}" class="agent-photo" alt="${esc(a.name)}" loading="lazy" />`
      : `<div class="agent-photo-placeholder">${esc((a.name||'A').slice(0,2).toUpperCase())}</div>`;
    return `
    <div class="agent-card" data-agent-id="${esc(a.id)}">
      ${photoEl}
      <div class="agent-info">
        <div class="agent-name"><span class="online-dot"></span>${esc(a.name)}</div>
        <div class="agent-service-badge">${esc(a.service||'Specialist')}</div>
        <div class="agent-skills">
          ${skills.map(s=>`<span class="skill-chip">${esc(s)}</span>`).join('')}
          ${extra > 0 ? `<span class="skill-chip more">+${extra} more</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="view-profile-btn" data-agent-id="${esc(a.id)}" style="background:#f1f5f9;border:none;border-radius:8px;padding:5px 12px;font-size:.75rem;font-weight:600;color:#475569;cursor:pointer;font-family:inherit" onclick="event.stopPropagation()">View Profile</button>
          <button style="background:#1d4ed8;border:none;border-radius:8px;padding:5px 14px;font-size:.75rem;font-weight:600;color:#fff;cursor:pointer;font-family:inherit">Chat Now</button>
        </div>
      </div>
    </div>`;
  }

  // ---- AGENT SELECTED ----
  function onAgentSelected(agent, cardEl) {
    document.querySelectorAll('.agent-card').forEach(c => c.classList.remove('active'));
    if (cardEl) cardEl.classList.add('active');
    selectedAgent = agent;

    if (!currentUser) {
      // Show auth gate
      document.getElementById('chatEmpty').style.display = 'none';
      document.getElementById('authGate').style.display = 'flex';
      document.getElementById('chatActive').classList.remove('visible');
      // Store next=chat.html?agent=id in login link
      document.querySelectorAll('#authGate a').forEach(a => {
        if (a.href.includes('login.html')) a.href = `login.html?next=chat.html`;
      });
      return;
    }

    openChat(agent);
  }

  function openChat(agent) {
    document.getElementById('chatEmpty').style.display = 'none';
    document.getElementById('authGate').style.display = 'none';
    document.getElementById('chatActive').classList.add('visible');
    renderChatHeader(agent);
    loadOrCreateConversation(agent);
  }

  function renderChatHeader(agent) {
    const hdr = document.getElementById('chatHeader');
    const photoEl = agent.photoUrl
      ? `<img src="${esc(agent.photoUrl)}" class="chat-header-photo" />`
      : `<div class="chat-header-photo-ph">${esc((agent.name||'A').slice(0,2).toUpperCase())}</div>`;
    hdr.innerHTML = `
      ${photoEl}
      <div class="chat-header-info">
        <div class="chat-header-name">${esc(agent.name)}</div>
        <div class="chat-header-meta"><span class="online-dot"></span> Online · ${esc(agent.service||'Specialist')}</div>
      </div>
      <div class="chat-header-actions">
        <button class="btn-sm btn-outline" id="viewAgentBtn">View Profile</button>
      </div>`;
    document.getElementById('viewAgentBtn').onclick = () => showAgentModal(agent);
  }

  async function loadOrCreateConversation(agent) {
    const uid = currentUser.uid;
    const agentId = agent.id;
    const msgWrap = document.getElementById('chatMessages');
    msgWrap.innerHTML = '<div style="display:flex;justify-content:center;padding:30px"><div class="spinner"></div></div>';

    // Find existing conversation
    const snap = await db.collection('agent_conversations')
      .where('agentId','==',agentId)
      .where('userId','==',uid)
      .limit(1).get();

    let convId;
    if (snap.empty) {
      const ref = await db.collection('agent_conversations').add({
        agentId,
        agentName: agent.name,
        agentPhoto: agent.photoUrl || '',
        userId: uid,
        userName: currentUser.displayName || currentUser.email,
        userEmail: currentUser.email,
        lastMessage: '',
        lastMessageAt: TS(),
        createdAt: TS(),
        unreadAgent: 0,
        unreadUser: 0
      });
      convId = ref.id;
    } else {
      convId = snap.docs[0].id;
      // Reset user unread
      snap.docs[0].ref.update({ unreadUser: 0 }).catch(()=>{});
    }

    currentConvId = convId;
    subscribeMessages(convId, agent);
  }

  function subscribeMessages(convId, agent) {
    if (msgUnsubscribe) msgUnsubscribe();
    const msgWrap = document.getElementById('chatMessages');
    msgUnsubscribe = db.collection('agent_messages')
      .where('conversationId','==',convId)
      .orderBy('createdAt','asc')
      .onSnapshot(snap => {
        msgWrap.innerHTML = '';
        if (snap.empty) {
          msgWrap.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#94a3b8;font-size:.85rem">👋 Say hello to ' + esc(agent.name) + '!</div>';
          return;
        }
        let lastDay = '';
        snap.forEach(doc => {
          const m = doc.data();
          const ts = m.createdAt?.toDate ? m.createdAt.toDate() : new Date();
          const dayStr = ts.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
          if (dayStr !== lastDay) {
            lastDay = dayStr;
            const sep = document.createElement('div');
            sep.className = 'day-divider';
            sep.textContent = dayStr;
            msgWrap.appendChild(sep);
          }
          const isMine = m.senderType === 'user' && m.senderId === currentUser.uid;
          const row = document.createElement('div');
          row.className = `msg-row ${isMine ? 'mine' : 'theirs'}`;
          const time = ts.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

          let contentHtml = '';
          if (m.type === 'image') {
            contentHtml = `<div class="msg-bubble" style="padding:4px"><img src="${esc(m.fileUrl)}" class="msg-img" onclick="window.open('${esc(m.fileUrl)}','_blank')" /></div>`;
          } else if (m.type === 'file') {
            contentHtml = `<a class="msg-file" href="${esc(m.fileUrl)}" target="_blank" rel="noopener"><i class="fas fa-file-alt"></i><span>${esc(m.fileName||'File')}</span></a>`;
          } else if (m.type === 'url') {
            contentHtml = `<div class="msg-bubble"><a class="msg-url" href="${esc(m.content)}" target="_blank" rel="noopener">${esc(m.content)}</a></div>`;
          } else {
            contentHtml = `<div class="msg-bubble">${escHtml(m.content||'')}</div>`;
          }

          const avatarEl = isMine
            ? `<div class="msg-avatar-user">${(currentUser.displayName||currentUser.email||'U')[0].toUpperCase()}</div>`
            : (agent.photoUrl ? `<img src="${esc(agent.photoUrl)}" class="msg-avatar" />` : `<div class="msg-avatar-ph">${(agent.name||'A').slice(0,2).toUpperCase()}</div>`);

          row.innerHTML = `${avatarEl}<div><div style="display:flex;flex-direction:column">${contentHtml}<div class="msg-meta">${time}</div></div></div>`;
          msgWrap.appendChild(row);
        });
        msgWrap.scrollTop = msgWrap.scrollHeight;
      }, err => console.warn('Chat listen error:', err));
  }

  // ---- SEND MESSAGE ----
  async function sendMessage() {
    if (!currentUser || !currentConvId) return;
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text && !pendingAttachments.length) return;

    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    input.value = '';

    const base = {
      conversationId: currentConvId,
      senderId: currentUser.uid,
      senderType: 'user',
      senderName: currentUser.displayName || currentUser.email,
      createdAt: TS()
    };

    // Upload attachments first
    for (const att of pendingAttachments) {
      try {
        const ref = storage.ref(`chat/${currentConvId}/${Date.now()}_${att.file.name}`);
        await ref.put(att.file);
        const url = await ref.getDownloadURL();
        await db.collection('agent_messages').add({
          ...base,
          type: att.type,
          fileUrl: url,
          fileName: att.file.name,
          content: ''
        });
      } catch(e) { console.error('Upload error:', e); }
    }

    // Send text / URL
    if (text) {
      const urlPattern = /^(https?:\/\/[^\s]+)$/i;
      const msgType = urlPattern.test(text) ? 'url' : 'text';
      await db.collection('agent_messages').add({ ...base, type: msgType, content: text });
    }

    // Update conversation
    db.collection('agent_conversations').doc(currentConvId).update({
      lastMessage: text || (pendingAttachments.length ? '[attachment]' : ''),
      lastMessageAt: TS(),
      unreadAgent: firebase.firestore.FieldValue.increment(1)
    }).catch(()=>{});

    pendingAttachments = [];
    renderAttachPreviews();
    sendBtn.disabled = false;
    input.focus();
  }

  // ---- ATTACHMENTS ----
  function renderAttachPreviews() {
    const wrap = document.getElementById('attachPreviews');
    if (!pendingAttachments.length) { wrap.style.display = 'none'; wrap.innerHTML = ''; return; }
    wrap.style.display = 'flex';
    wrap.innerHTML = pendingAttachments.map((att, i) => {
      if (att.type === 'image') {
        return `<div class="attach-preview"><img src="${att.previewUrl}" /><button class="rm" onclick="removeAttachment(${i})">×</button></div>`;
      }
      return `<div class="attach-file-badge"><i class="fas fa-file-alt"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px">${esc(att.file.name)}</span><button class="rm" onclick="removeAttachment(${i})">×</button></div>`;
    }).join('');
  }
  window.removeAttachment = function(i) { pendingAttachments.splice(i,1); renderAttachPreviews(); };

  // ---- AGENT MODAL ----
  function showAgentModal(a) {
    const box = document.getElementById('agentModalContent');
    const skills = a.skills || [];
    const photoEl = a.photoUrl
      ? `<img src="${esc(a.photoUrl)}" class="full-agent-photo" />`
      : `<div class="full-agent-photo-ph">${(a.name||'A').slice(0,2).toUpperCase()}</div>`;
    box.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px">
        <h3 style="margin:0">${esc(a.name)}'s Profile</h3>
        <button onclick="document.getElementById('agentModal').classList.remove('open')" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#94a3b8">×</button>
      </div>
      ${photoEl}
      <div style="text-align:center;margin-bottom:20px">
        <div style="font-size:1.1rem;font-weight:700;color:#0f172a;margin-bottom:4px">${esc(a.name)}</div>
        <div style="display:inline-block;background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:100px;padding:3px 14px;font-size:.8rem;font-weight:600">${esc(a.service||'Specialist')}</div>
        ${a.bio ? `<p style="color:#64748b;font-size:.85rem;margin-top:12px;line-height:1.6">${esc(a.bio)}</p>` : ''}
      </div>
      <div style="margin-top:8px">
        <div style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:#94a3b8;margin-bottom:10px">Skills</div>
        <div class="skills-cloud">
          ${skills.map(s=>`<span class="skill-tag">${esc(s)}</span>`).join('')}
        </div>
      </div>
      <button class="btn-sm btn-primary" style="width:100%;margin-top:24px;padding:12px;border-radius:10px;font-size:.92rem" onclick="document.getElementById('agentModal').classList.remove('open'); onAgentSelected(allAgents.find(x=>x.id==='${esc(a.id)}'), document.querySelector('[data-agent-id=\\'${esc(a.id)}\\']'))">
        <i class="fas fa-comment"></i> Start Chat
      </button>`;
    document.getElementById('agentModal').classList.add('open');
  }

  // expose for inline onclick
  window.allAgents = allAgents;
  window.onAgentSelected = onAgentSelected;

  // ---- SEARCH ----
  document.getElementById('agentSearch').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const filtered = allAgents.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.service||'').toLowerCase().includes(q) ||
      (a.skills||[]).some(s => s.toLowerCase().includes(q))
    );
    renderAgentCards(filtered);
  });

  // ---- INPUT EVENTS ----
  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('msgInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById('msgInput').addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  document.getElementById('attachImageBtn').addEventListener('click', () => document.getElementById('imageInput').click());
  document.getElementById('attachFileBtn').addEventListener('click', () => document.getElementById('fileInput').click());

  document.getElementById('imageInput').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { pendingAttachments.push({ type:'image', file, previewUrl: ev.target.result }); renderAttachPreviews(); };
    reader.readAsDataURL(file);
    e.target.value = '';
  });

  document.getElementById('fileInput').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    pendingAttachments.push({ type:'file', file, previewUrl: null });
    renderAttachPreviews();
    e.target.value = '';
  });

  // Close modal on overlay click
  document.getElementById('agentModal').addEventListener('click', e => {
    if (e.target === document.getElementById('agentModal')) document.getElementById('agentModal').classList.remove('open');
  });

  // Mobile
  const openAgentsBtn = document.getElementById('openAgentsBtn');
  if (openAgentsBtn) {
    if (window.innerWidth <= 768) openAgentsBtn.style.display = 'flex';
    openAgentsBtn.addEventListener('click', () => document.getElementById('agentsPanel').classList.toggle('open'));
  }

  // ---- HELPERS ----
  function esc(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
  function escHtml(str) { return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>'); }

  // ---- INIT ----
  loadAgents();
})();
