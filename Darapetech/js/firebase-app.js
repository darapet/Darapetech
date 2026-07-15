/* ============================================================
   DARAPET TECHNOLOGY — FIREBASE INTEGRATION
   Firestore: contacts | newsletter | portfolio | testimonials
             stats | pricing_inquiries | chat_rooms | chat_messages
   Auth: Firebase Email/Password (chat users)
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyBC-h8IhM1wMXM_PQcN3ofkda6uQoZlW_8",
  authDomain: "darapettech.firebaseapp.com",
  projectId: "darapettech",
  storageBucket: "darapettech.firebasestorage.app",
  messagingSenderId: "371840400221",
  appId: "1:371840400221:web:3e1008d7e773b78efd46b4",
  measurementId: "G-QVD5L225YE"
};

firebase.initializeApp(firebaseConfig);
const db   = firebase.firestore();
const auth = firebase.auth();
const TS   = () => firebase.firestore.FieldValue.serverTimestamp();

// Wraps any promise with a hard timeout so UI never gets stuck forever
function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms)
    )
  ]);
}

/* ================================================================
   STATS — read from Firestore, update data-target on counters
   ================================================================ */
async function loadAndApplyStats() {
  try {
    const snap = await db.collection('stats').get();
    if (snap.empty) return;
    const data = {};
    snap.forEach(doc => { data[doc.id] = doc.data().value; });

    const keys   = ['projects','clients','years','satisfaction'];
    const counts    = [...document.querySelectorAll('.count[data-target]')];
    const bigCounts = [...document.querySelectorAll('.big-count[data-target]')];

    keys.forEach((key, i) => {
      const val = data[key];
      if (val == null) return;
      if (counts[i])    counts[i].dataset.target    = val;
      if (bigCounts[i]) bigCounts[i].dataset.target = val;
    });

    // Re-trigger the counter animation if animateCounters exists
    if (typeof animateCounters === 'function') animateCounters();
  } catch(e) { console.warn('Stats load:', e.message); }
}

/* ================================================================
   NEWSLETTER
   ================================================================ */
async function subscribeNewsletter(email) {
  const snap = await withTimeout(
    db.collection('newsletter').where('email','==',email).get()
  );
  if (!snap.empty) {
    const doc = snap.docs[0];
    if (!doc.data().active) {
      await withTimeout(doc.ref.update({ active:true }));
      return 'resubscribed';
    }
    return 'already';
  }
  await withTimeout(
    db.collection('newsletter').add({ email, active:true, createdAt:TS() })
  );
  return 'subscribed';
}

/* ================================================================
   CONTACT FORM — overrides the inline submitForm() in contact.html
   ================================================================ */
function submitForm() {
  const fname   = (document.getElementById('fname')  ?.value||'').trim();
  const lname   = (document.getElementById('lname')  ?.value||'').trim();
  const email   = (document.getElementById('email')  ?.value||'').trim();
  const phone   = (document.getElementById('phone')  ?.value||'').trim();
  const company = (document.getElementById('company')?.value||'').trim();
  const message = (document.getElementById('message')?.value||'').trim();
  const source  = (document.getElementById('source') ?.value||'');

  if (!message) { alert('Please describe your project before sending.'); return; }
  if (!email)   { alert('Please add your email so we can reply.'); return; }

  const services = [...document.querySelectorAll('.chip.selected')].map(c => c.dataset.val);
  const budget   = document.querySelector('.budget-pill.selected')?.textContent?.trim() || 'Not specified';

  const btn = document.getElementById('submitBtn');
  const origLabel = btn ? btn.innerHTML : '';
  if (btn) { btn.innerHTML = 'Sending… <i class="ph-fill ph-circle-notch"></i>'; btn.disabled = true; }

  const resetBtn = () => {
    if (btn) { btn.innerHTML = origLabel || 'Send Brief <i class="ph-fill ph-paper-plane-tilt"></i>'; btn.disabled = false; }
  };
  const showSuccess = () => {
    const step3   = document.getElementById('form-step-3');
    const success = document.getElementById('form-success');
    const bar     = document.querySelector('.form-step-bar');
    if (step3)   step3.style.display = 'none';
    if (success) success.classList.add('visible');
    if (bar)     bar.style.display = 'none';
  };

  withTimeout(
    db.collection('contacts').add({
      name: `${fname} ${lname}`.trim() || 'Anonymous',
      email, phone, company, services, budget, message, source,
      status: 'new', createdAt: TS()
    }),
    12000
  ).then(() => {
    showSuccess();
  }).catch(err => {
    console.warn('Firestore save failed, using mailto fallback:', err.message);
    // Fallback: open mailto so the message still reaches the inbox
    const subject = encodeURIComponent(`New Project Brief from ${fname} ${lname}`);
    const body = encodeURIComponent(
      `Name: ${fname} ${lname}\nEmail: ${email}\nPhone: ${phone||'N/A'}\nCompany: ${company||'N/A'}\n\nServices: ${services.join(', ')||'N/A'}\nBudget: ${budget}\nSource: ${source||'N/A'}\n\nProject Brief:\n${message}`
    );
    window.location.href = `mailto:darapettechnology@gmail.com?subject=${subject}&body=${body}`;
    showSuccess();
    resetBtn();
  });
}

/* ================================================================
   PRICING INQUIRY
   ================================================================ */
async function submitPricingInquiry(data) {
  return db.collection('pricing_inquiries').add({ ...data, status:'pending', createdAt:TS() });
}

/* ================================================================
   TESTIMONIALS — public load
   ================================================================ */
async function loadTestimonialsPublic() {
  const snap = await db.collection('testimonials')
    .where('active','==',true)
    .orderBy('createdAt','desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ================================================================
   PORTFOLIO — public load
   ================================================================ */
async function loadPortfolioPublic(filters = {}) {
  let q = db.collection('portfolio').orderBy('sortOrder');
  const snap = await q.get();
  let results = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  if (filters.category) results = results.filter(p => p.category === filters.category);
  if (filters.featured)  results = results.filter(p => p.featured);
  return results;
}

/* ================================================================
   CHAT — public read + auth write
   ================================================================ */
let chatUnsubscribe = null;

async function initChat() {
  const app = document.getElementById('chatApp');
  if (!app) return;

  const roomsSnap = await db.collection('chat_rooms').orderBy('createdAt').get();
  const rooms = roomsSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  if (!rooms.length) { app.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:40px">No chat rooms yet.</p>'; return; }

  renderChatUI(app, rooms);
}

function renderChatUI(container, rooms) {
  container.innerHTML = `
  <div class="chat-layout">
    <!-- Auth panel -->
    <div class="chat-auth-panel" id="chatAuthPanel">
      <div class="chat-auth-box glass-card">
        <h3 style="margin-bottom:4px">Join the chat</h3>
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:20px">Create an account or sign in to send messages.</p>
        <div class="chat-tabs" style="display:flex;gap:8px;margin-bottom:20px">
          <button class="btn btn-primary" style="flex:1" id="showLogin">Sign In</button>
          <button class="btn btn-outline" style="flex:1" id="showRegister">Register</button>
        </div>
        <div id="authForm">
          <div class="fl-group" style="margin-bottom:12px">
            <input class="fl-input" type="email" id="authEmail" placeholder=" " />
            <label class="fl-label" for="authEmail">Email</label>
          </div>
          <div id="usernameField" class="fl-group" style="margin-bottom:12px;display:none">
            <input class="fl-input" type="text" id="authUsername" placeholder=" " />
            <label class="fl-label" for="authUsername">Display name</label>
          </div>
          <div class="fl-group" style="margin-bottom:16px">
            <input class="fl-input" type="password" id="authPassword" placeholder=" " />
            <label class="fl-label" for="authPassword">Password</label>
          </div>
          <div id="authError" style="color:#ef4444;font-size:.82rem;margin-bottom:12px;display:none"></div>
          <button class="btn btn-primary" style="width:100%" id="authSubmit">Sign In</button>
        </div>
      </div>
    </div>

    <!-- Chat room -->
    <div class="chat-room-panel" id="chatRoomPanel" style="display:none">
      <div class="chat-sidebar glass-card">
        <div class="chat-user-info" id="chatUserInfo"></div>
        <div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin:16px 0 8px">Rooms</div>
        <div class="chat-rooms-list" id="chatRoomsList">
          ${rooms.map(r => `<div class="chat-room-item" data-room-id="${r.id}" data-room-name="${r.name}">${r.name}</div>`).join('')}
        </div>
        <button class="btn btn-ghost" style="width:100%;margin-top:auto;font-size:.8rem" id="chatSignOut">Sign Out</button>
      </div>
      <div class="chat-main">
        <div class="chat-header" id="chatHeader">
          <strong id="chatRoomName">Select a room</strong>
          <span id="chatRoomDesc" style="font-size:.8rem;color:var(--text-muted)"></span>
        </div>
        <div class="chat-messages" id="chatMessages"><p style="text-align:center;color:var(--text-muted);padding:40px">Pick a room to start chatting</p></div>
        <div class="chat-input-area" id="chatInputArea" style="display:none">
          <span id="typingIndicator" style="font-size:.75rem;color:var(--text-muted);min-height:18px;display:block;margin-bottom:4px"></span>
          <div style="display:flex;gap:8px">
            <input type="text" class="fl-input" id="chatInput" placeholder="Type a message…" style="flex:1" />
            <button class="btn btn-primary" id="chatSendBtn"><i class="ph-fill ph-paper-plane-tilt"></i></button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <style>
    .chat-layout { min-height: 520px; }
    .chat-auth-panel { display:flex; align-items:center; justify-content:center; padding:40px 20px; }
    .chat-auth-box { padding:32px; max-width:420px; width:100%; }
    .chat-room-panel { display:flex; gap:0; height:560px; border-radius:16px; overflow:hidden; border:1px solid var(--border); }
    .chat-sidebar { width:220px; flex-shrink:0; padding:20px 16px; display:flex; flex-direction:column; gap:4px; border-radius:0!important; border:none!important; border-right:1px solid var(--border)!important; }
    .chat-room-item { padding:9px 12px; border-radius:8px; cursor:pointer; font-size:.88rem; font-weight:500; color:var(--text-secondary); transition:var(--transition); }
    .chat-room-item:hover, .chat-room-item.active { background:rgba(37,99,235,.12); color:var(--accent-1); }
    .chat-main { flex:1; display:flex; flex-direction:column; overflow:hidden; }
    .chat-header { padding:14px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px; background:var(--bg-card); }
    .chat-messages { flex:1; overflow-y:auto; padding:16px 20px; display:flex; flex-direction:column; gap:10px; }
    .chat-bubble { max-width:72%; padding:10px 14px; border-radius:14px; font-size:.88rem; line-height:1.45; }
    .chat-bubble.mine { align-self:flex-end; background:var(--accent-1); color:#fff; border-bottom-right-radius:4px; }
    .chat-bubble.theirs { align-self:flex-start; background:var(--bg-card); border:1px solid var(--border); border-bottom-left-radius:4px; }
    .chat-bubble .bubble-meta { font-size:.68rem; opacity:.7; margin-bottom:3px; font-weight:600; }
    .chat-input-area { padding:14px 20px; border-top:1px solid var(--border); background:var(--bg-card); }
    .chat-user-info { background:rgba(37,99,235,.08); border-radius:10px; padding:10px 12px; font-size:.82rem; }
    @media(max-width:640px){.chat-room-panel{flex-direction:column;height:auto}.chat-sidebar{width:100%;flex-direction:row;overflow-x:auto;border-right:none!important;border-bottom:1px solid var(--border)!important}.chat-rooms-list{display:flex;gap:6px}.chat-main{min-height:360px}}
  </style>`;

  // Wire auth tabs
  let isLogin = true;
  document.getElementById('showLogin').addEventListener('click', () => {
    isLogin = true;
    document.getElementById('usernameField').style.display = 'none';
    document.getElementById('authSubmit').textContent = 'Sign In';
    document.getElementById('showLogin').classList.replace('btn-outline','btn-primary');
    document.getElementById('showRegister').classList.replace('btn-primary','btn-outline');
  });
  document.getElementById('showRegister').addEventListener('click', () => {
    isLogin = false;
    document.getElementById('usernameField').style.display = '';
    document.getElementById('authSubmit').textContent = 'Create Account';
    document.getElementById('showRegister').classList.replace('btn-outline','btn-primary');
    document.getElementById('showLogin').classList.replace('btn-primary','btn-outline');
  });

  document.getElementById('authSubmit').addEventListener('click', async () => {
    const email    = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const username = document.getElementById('authUsername').value.trim();
    const errEl    = document.getElementById('authError');
    errEl.style.display = 'none';
    if (!email || !password) { errEl.textContent='Please fill all fields'; errEl.style.display=''; return; }
    try {
      if (isLogin) {
        await auth.signInWithEmailAndPassword(email, password);
      } else {
        if (!username) { errEl.textContent='Display name is required'; errEl.style.display=''; return; }
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: username });
        await db.collection('users').doc(cred.user.uid).set({
          username, email, avatarInitials: username.slice(0,2).toUpperCase(), createdAt: TS()
        });
      }
    } catch(e) {
      errEl.textContent = e.message;
      errEl.style.display = '';
    }
  });

  auth.onAuthStateChanged(user => {
    document.getElementById('chatAuthPanel').style.display  = user ? 'none' : '';
    document.getElementById('chatRoomPanel').style.display  = user ? ''     : 'none';
    if (user) {
      const name = user.displayName || user.email;
      document.getElementById('chatUserInfo').innerHTML = `<span style="font-weight:700">${name}</span><br><span style="color:var(--text-muted);font-size:.75rem">${user.email}</span>`;
    }
  });

  document.getElementById('chatSignOut')?.addEventListener('click', () => {
    auth.signOut();
    if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; }
    document.getElementById('chatMessages').innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px">Pick a room to start chatting</p>';
    document.getElementById('chatInputArea').style.display = 'none';
    document.getElementById('chatRoomName').textContent = 'Select a room';
  });

  // Wire room selection
  let currentRoomId = null;
  document.querySelectorAll('.chat-room-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.chat-room-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const rid  = item.dataset.roomId;
      const name = item.dataset.roomName;
      currentRoomId = rid;
      document.getElementById('chatRoomName').textContent = '# ' + name;
      document.getElementById('chatInputArea').style.display = '';
      loadRoomMessages(rid);
    });
  });

  // Wire send
  document.getElementById('chatSendBtn').addEventListener('click', sendChatMessage);
  document.getElementById('chatInput').addEventListener('keypress', e => { if (e.key === 'Enter') sendChatMessage(); });

  function sendChatMessage() {
    const user = auth.currentUser;
    if (!user || !currentRoomId) return;
    const input = document.getElementById('chatInput');
    const content = input.value.trim();
    if (!content) return;
    input.value = '';
    db.collection('chat_messages').add({
      roomId: currentRoomId,
      userId: user.uid,
      username: user.displayName || user.email,
      content, createdAt: TS()
    });
  }

  function loadRoomMessages(roomId) {
    if (chatUnsubscribe) chatUnsubscribe();
    const msgEl = document.getElementById('chatMessages');
    msgEl.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Loading…</p>';

    chatUnsubscribe = db.collection('chat_messages')
      .where('roomId','==',roomId)
      .orderBy('createdAt','asc')
      .limitToLast(100)
      .onSnapshot(snap => {
        const user = auth.currentUser;
        msgEl.innerHTML = '';
        if (snap.empty) { msgEl.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:30px">No messages yet. Say hello!</p>'; return; }
        snap.forEach(doc => {
          const m   = doc.data();
          const mine = user && m.userId === user.uid;
          const ts  = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) : '';
          const div = document.createElement('div');
          div.className = `chat-bubble ${mine ? 'mine' : 'theirs'}`;
          div.innerHTML = `<div class="bubble-meta">${mine ? 'You' : m.username} · ${ts}</div>${escapeHtml(m.content)}`;
          msgEl.appendChild(div);
        });
        msgEl.scrollTop = msgEl.scrollHeight;
      }, err => console.warn('Chat listen:', err));
  }
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ================================================================
   ADMIN PANEL
   ================================================================ */
// The one and only account allowed into the admin dashboard. Must match the
// email inside isAdmin() in your Firestore rules, character for character.
const ADMIN_EMAIL = 'daramolapeter98@gmail.com';

function initAdmin() {
  const app = document.getElementById('adminApp');
  if (!app) return;

  // Show a visible loading state immediately so the page is never blank
  app.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
    <div style="text-align:center;color:#64748b">
      <div style="width:32px;height:32px;border:3px solid #bfdbfe;border-top-color:#1d4ed8;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 14px"></div>
      <p style="font-size:.85rem;font-family:inherit">Loading admin panel…</p>
    </div>
  </div>`;

  // Fallback: if Firebase auth never fires within 4s, just show the login form
  const authTimeout = setTimeout(() => showAdminLogin(), 4000);

  // Firebase Auth persists sign-in across visits by default, so once this
  // Google account has signed in on a browser once, it stays signed in and
  // future visits land straight on the dashboard with no extra click.
  auth.onAuthStateChanged(user => {
    clearTimeout(authTimeout);
    if (user && user.email === ADMIN_EMAIL) {
      mountAdminDashboard();
    } else if (user) {
      showAdminUnauthorized(user);
    } else {
      showAdminLogin();
    }
  });
}

function showAdminUnauthorized(user) {
  const app = document.getElementById('adminApp');
  app.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
    <div class="glass-card" style="padding:40px;max-width:420px;width:100%;text-align:center">
      <i class="ph-fill ph-warning-circle" style="font-size:2.5rem;color:#ef4444;margin-bottom:12px"></i>
      <h2 style="margin-bottom:6px">Not Authorized</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:24px">You're signed in as ${user.email}, which isn't the admin account for this site.</p>
      <button class="btn btn-outline" style="width:100%" id="adminSwitchAccountBtn">Sign in with a different Google account</button>
    </div>
  </div>`;
  document.getElementById('adminSwitchAccountBtn').addEventListener('click', async () => {
    await auth.signOut();
    showAdminLogin();
  });
}

function showAdminLogin() {
  const app = document.getElementById('adminApp');
  app.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:center;min-height:60vh">
    <div class="glass-card" style="padding:40px;max-width:400px;width:100%;text-align:center">
      <i class="ph-fill ph-lock-simple" style="font-size:2.5rem;color:var(--accent-1);margin-bottom:12px"></i>
      <h2 style="margin-bottom:6px">Admin Access</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin-bottom:24px">Sign in with the admin Google account to continue.</p>
      <button class="btn btn-primary" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px" id="adminGoogleBtn">
        <i class="ph-fill ph-google-logo"></i> Sign in with Google
      </button>
      <div id="adminLoginErr" style="color:#ef4444;font-size:.82rem;margin-top:14px;display:none"></div>
    </div>
  </div>`;

  const btn = document.getElementById('adminGoogleBtn');
  const err = document.getElementById('adminLoginErr');
  btn.addEventListener('click', async () => {
    err.style.display = 'none';
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
      // onAuthStateChanged above will fire and route to the dashboard or
      // the "not authorized" screen depending on which account was picked.
    } catch (e) {
      console.error('Admin Google sign-in failed:', e.code, e.message);
      err.textContent = 'Sign-in failed: ' + e.message;
      err.style.display = '';
    }
    btn.disabled = false;
    btn.innerHTML = '<i class="ph-fill ph-google-logo"></i> Sign in with Google';
  });
}

function mountAdminDashboard() {
  const app = document.getElementById('adminApp');
  app.innerHTML = `
  <div class="admin-layout" style="padding-top:0;min-height:100vh">
    <div class="admin-sidebar-overlay" id="admSidebarOverlay"></div>
    <aside class="admin-sidebar" id="admSidebar">
      <h3>Dashboard</h3>
      <nav class="admin-nav">
        <a href="#" class="active" data-section="adm-overview"><i class="ph-fill ph-gauge"></i> Overview</a>
        <a href="#" data-section="adm-messages"><i class="ph-fill ph-inbox"></i> Messages <span class="unread-badge" id="unreadBadge">0</span></a>
        <a href="#" data-section="adm-newsletter"><i class="ph-fill ph-envelope-simple"></i> Newsletter</a>
        <a href="#" data-section="adm-portfolio"><i class="ph-fill ph-images"></i> Portfolio</a>
        <a href="#" data-section="adm-portfolio-gallery"><i class="ph-fill ph-stack"></i> Portfolio Gallery</a>
        <a href="#" data-section="adm-testimonials"><i class="ph-fill ph-star"></i> Testimonials</a>
        <a href="#" data-section="adm-stats"><i class="ph-fill ph-chart-bar"></i> Live Stats</a>
        <a href="#" data-section="adm-pricing"><i class="ph-fill ph-money"></i> Pricing Inquiries</a>
        <a href="#" data-section="adm-chat"><i class="ph-fill ph-chat-circle-dots"></i> Live Chat</a>
        <a href="#" data-section="adm-customers"><i class="ph-fill ph-identification-card"></i> Customers</a>
        <a href="#" data-section="adm-agent-list"><i class="ph-fill ph-users-three"></i> Agent List</a>
        <a href="#" data-section="adm-agent-waitlist"><i class="ph-fill ph-clock-countdown"></i> Agent Waitlist <span class="unread-badge" id="waitlistBadge" style="display:none">0</span></a>
        <a href="#" data-section="adm-create-agent"><i class="ph-fill ph-user-plus"></i> Create Agent</a>
        <a href="#" data-section="adm-socials"><i class="ph-fill ph-share-network"></i> Social Links</a>
        <a href="#" data-section="adm-settings"><i class="ph-fill ph-gear"></i> Settings</a>
      </nav>
      <div style="margin-top:auto;padding-top:32px;border-top:1px solid var(--border)">
        <a href="../index.html" style="display:flex;align-items:center;gap:8px;font-size:.85rem;color:var(--text-muted);padding:8px 12px"><i class="ph-fill ph-arrow-square-out"></i> View Live Site</a>
        <a href="#" id="admLogout" style="display:flex;align-items:center;gap:8px;font-size:.85rem;color:#ef4444;padding:8px 12px"><i class="ph-fill ph-sign-out"></i> Logout</a>
      </div>
    </aside>
    <main class="admin-main">
      <button class="admin-mobile-toggle" id="admMobileToggle"><i class="ph-fill ph-list"></i> Menu</button>
      <div id="adm-overview"    class="admin-section active"><h2>Loading…</h2></div>
      <div id="adm-messages"    class="admin-section"></div>
      <div id="adm-newsletter"  class="admin-section"></div>
      <div id="adm-portfolio"         class="admin-section"></div>
      <div id="adm-portfolio-gallery" class="admin-section"></div>
      <div id="adm-testimonials" class="admin-section"></div>
      <div id="adm-stats"       class="admin-section"></div>
      <div id="adm-pricing"     class="admin-section"></div>
      <div id="adm-chat"        class="admin-section"></div>
      <div id="adm-customers"   class="admin-section"></div>
      <div id="adm-agent-list"     class="admin-section"></div>
      <div id="adm-agent-waitlist" class="admin-section"></div>
      <div id="adm-create-agent"  class="admin-section"></div>
      <div id="adm-socials"     class="admin-section"></div>
      <div id="adm-settings"    class="admin-section"></div>
    </main>
  </div>`;

  document.getElementById('admLogout').addEventListener('click', e => {
    e.preventDefault(); sessionStorage.removeItem('dt_admin'); auth.signOut(); location.reload();
  });

  const sidebar = document.getElementById('admSidebar');
  const overlay = document.getElementById('admSidebarOverlay');
  const closeSidebar = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); };
  document.getElementById('admMobileToggle').addEventListener('click', () => {
    sidebar.classList.add('open'); overlay.classList.add('open');
  });
  overlay.addEventListener('click', closeSidebar);

  document.querySelectorAll('.admin-nav a[data-section]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const sec = link.dataset.section;
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      document.querySelectorAll('.admin-nav a').forEach(a => a.classList.remove('active'));
      document.getElementById(sec).classList.add('active');
      link.classList.add('active');
      loadAdminSection(sec);
      closeSidebar(); // collapse the mobile drawer after navigating
    });
  });

  loadAdminSection('adm-overview');
  loadAdminSocials(); // socials use localStorage
}

async function loadAdminSection(sec) {
  const el = document.getElementById(sec);
  if (!el) return;
  if (el.dataset.loaded) return;

  switch(sec) {
    case 'adm-overview':    await renderAdminOverview(el);    break;
    case 'adm-messages':    await renderAdminMessages(el);    el.dataset.loaded='1'; break;
    case 'adm-newsletter':  await renderAdminNewsletter(el);  el.dataset.loaded='1'; break;
    case 'adm-portfolio':         await renderAdminPortfolio(el);         break; // always fresh
    case 'adm-portfolio-gallery': await renderAdminPortfolioGallery(el); break; // always fresh
    case 'adm-testimonials':await renderAdminTestimonials(el);break;
    case 'adm-stats':       await renderAdminStats(el);       break;
    case 'adm-pricing':     await renderAdminPricing(el);     el.dataset.loaded='1'; break;
    case 'adm-chat':        await renderAdminChat(el);        break; // always live
    case 'adm-customers':   await renderAdminCustomers(el);   break;
    case 'adm-agent-list':     await renderAdminAgentList(el);    break;
    case 'adm-agent-waitlist': await renderAdminAgentWaitlist(el); break;
    case 'adm-create-agent':  await renderAdminCreateAgent(el);   break;
    case 'adm-socials':     renderAdminSocials(el);           el.dataset.loaded='1'; break;
    case 'adm-settings':    await renderAdminSettings(el);    break;
  }
}

/* ---- AGENTS ---- */
const AGENT_SERVICES_SKILLS = {
  'Web & App Development': ['Website Development','WordPress','Shopify','Mobile App Development','React.js','Vue.js','Node.js','PHP','MySQL','PostgreSQL','REST API','GraphQL','UI/UX Design','Figma','HTML/CSS','JavaScript','TypeScript','Git','Docker','AWS'],
  'Video Editing': ['Adobe Premiere Pro','After Effects','DaVinci Resolve','Motion Graphics','Color Grading','Sound Design','YouTube Videos','Short-Form/Reels','Corporate Videos','2D Animation','Subtitles & Captions','Thumbnail Design','VFX','Transitions','4K Editing','Audio Mixing','Storyboarding','Green Screen','Drone Footage','Brand Videos'],
  'Graphics & Design': ['Adobe Illustrator','Photoshop','InDesign','Figma','Logo Design','Brand Identity','UI/UX Design','Social Media Graphics','Print Design','Typography','Packaging Design','Infographics','Pitch Decks','Icon Design','Illustrations','Mockups','Banner Design','Email Templates','Business Cards','Poster Design'],
  'Digital Marketing': ['SEO','Google Ads','Facebook Ads','Instagram Ads','TikTok Ads','Email Campaigns','Content Strategy','Social Media Management','Analytics','Conversion Optimization','Copywriting','Keyword Research','Link Building','YouTube SEO','Influencer Outreach','A/B Testing','Landing Pages','Marketing Funnels','Brand Awareness','Competitor Analysis'],
  'Email Marketing': ['Mailchimp','Brevo/Sendinblue','Klaviyo','Campaign Monitor','Email Design','List Segmentation','Automation Flows','A/B Testing','Newsletter Design','Drip Campaigns','Lead Nurturing','Email Analytics','Subscriber Growth','Deliverability','GDPR Compliance','Welcome Sequences','Re-engagement Campaigns','Transactional Emails','Template Design','CRM Integration']
};

let agentCreatorApp = null;
function getAgentCreatorApp() {
  try {
    // Reuse existing secondary app if already initialized
    return firebase.app('agentCreator');
  } catch(e) {
    agentCreatorApp = firebase.initializeApp(firebaseConfig, 'agentCreator');
    return agentCreatorApp;
  }
}

async function generateAgentId() {
  const snap = await db.collection('agents').orderBy('createdAt','desc').limit(1).get();
  let nextNum = 1;
  if (!snap.empty) {
    const last = snap.docs[0].data().agentId || 'DT-000';
    const parts = last.split('-');
    nextNum = (parseInt(parts[1]||'0', 10) || 0) + 1;
  }
  return 'DT-' + String(nextNum).padStart(3, '0');
}

async function uploadToCloudinary(file) {
  const cfgDoc = await db.collection('settings').doc('cloudinary').get();
  if (!cfgDoc.exists) throw new Error('Cloudinary not configured — go to Settings and save your cloud name and upload preset first.');
  const { cloudName, uploadPreset } = cfgDoc.data();
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', uploadPreset);
  fd.append('folder', 'agents');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method:'POST', body:fd });
  const data = await res.json();
  if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed');
  return data.secure_url;
}

/* ---- AGENT LIST ---- */
async function renderAdminAgentList(el) {
  el.innerHTML = `
  <style>
    .agent-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
    .adm-agent-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;position:relative;transition:border-color .15s}
    .adm-agent-card:hover{border-color:var(--border-hover)}
    .adm-agent-photo{width:54px;height:54px;border-radius:12px;object-fit:cover;border:2px solid var(--border-hover);flex-shrink:0}
    .adm-agent-photo-ph{width:54px;height:54px;border-radius:12px;background:var(--accent-gradient);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.1rem;font-weight:700;flex-shrink:0}
    .adm-agent-id{display:inline-block;background:rgba(59,130,246,0.12);color:var(--accent-2);border:1px solid rgba(59,130,246,0.2);border-radius:100px;padding:2px 10px;font-size:.72rem;font-weight:700;letter-spacing:.05em}
    .adm-tag{background:rgba(148,163,184,0.12);color:var(--text-secondary);border-radius:100px;padding:2px 8px;font-size:.7rem}
    .agent-status-badge{font-size:.72rem;font-weight:700;padding:3px 10px;border-radius:100px;white-space:nowrap;flex-shrink:0}
    .status-active{background:rgba(16,185,129,0.15);color:#10b981}
    .status-suspended{background:rgba(245,158,11,0.15);color:#f59e0b}
    .status-banned{background:rgba(239,68,68,0.15);color:#ef4444}
    .adm-agent-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
    .adm-action-btn{font-size:.75rem;padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;cursor:pointer;font-family:inherit;color:var(--text-secondary);transition:all .15s;display:inline-flex;align-items:center;gap:5px}
    .adm-action-btn.suspend{color:#f59e0b;border-color:rgba(245,158,11,0.35)}
    .adm-action-btn.suspend:hover{background:rgba(245,158,11,0.1)}
    .adm-action-btn.ban{color:#ef4444;border-color:rgba(239,68,68,0.35)}
    .adm-action-btn.ban:hover{background:rgba(239,68,68,0.1)}
    .adm-action-btn.restore{color:#10b981;border-color:rgba(16,185,129,0.35)}
    .adm-action-btn.restore:hover{background:rgba(16,185,129,0.1)}
    .adm-action-btn.del{color:#ef4444;border-color:rgba(239,68,68,0.35)}
    .adm-action-btn.del:hover{background:rgba(239,68,68,0.1)}
  </style>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;flex-wrap:wrap;gap:12px">
    <div>
      <h2 style="margin:0 0 4px">Agent List</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin:0">Manage your specialists — suspend, ban or restore their access.</p>
    </div>
    <button class="btn btn-primary" id="goCreateAgentBtn" style="display:flex;align-items:center;gap:8px">
      <i class="ph-fill ph-user-plus"></i> Add New Agent
    </button>
  </div>

  <div id="admAgentsGrid" class="agent-grid">
    <div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--text-muted)">
      <div style="width:26px;height:26px;border:3px solid #bfdbfe;border-top-color:#1d4ed8;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px"></div>
      Loading agents…
    </div>
  </div>`;

  document.getElementById('goCreateAgentBtn').addEventListener('click', () => {
    document.querySelector('[data-section=adm-create-agent]').click();
  });

  async function loadAgentsList() {
    const grid = document.getElementById('admAgentsGrid');
    if (!grid) return;
    try {
      const snap = await db.collection('agents').orderBy('createdAt','desc').get();
      if (snap.empty) {
        grid.innerHTML = '<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--text-muted);font-size:.88rem">No agents yet. <a href="#" id="goCreateLink" style="color:var(--accent-1)">Create your first agent →</a></div>';
        document.getElementById('goCreateLink')?.addEventListener('click', e => { e.preventDefault(); document.querySelector('[data-section=adm-create-agent]').click(); });
        return;
      }
      grid.innerHTML = snap.docs.map(doc => {
        const a = doc.data();
        // New 'status' field takes priority; fall back to legacy 'active' boolean
        const status = a.status || (a.active === false ? 'suspended' : 'active');
        const statusLabel = { active:'Active', suspended:'Suspended', banned:'Banned' }[status] || status;
        const photoEl = a.photoUrl
          ? `<img src="${escapeHtml(a.photoUrl)}" class="adm-agent-photo" />`
          : `<div class="adm-agent-photo-ph">${escapeHtml((a.name||'A').slice(0,2).toUpperCase())}</div>`;
        const skills = (a.skills||[]).slice(0,4);
        const extra  = (a.skills||[]).length - skills.length;
        const dId   = doc.id;
        const dName = (a.name||'').replace(/'/g,"\\x27");

        let actions = '';
        if (status === 'active') {
          actions = `<button class="adm-action-btn suspend" onclick="setAgentStatus('${dId}','suspended')"><i class="ph-fill ph-pause-circle"></i> Suspend</button>
                     <button class="adm-action-btn ban" onclick="setAgentStatus('${dId}','banned')"><i class="ph-fill ph-prohibit"></i> Ban</button>`;
        } else if (status === 'suspended') {
          actions = `<button class="adm-action-btn restore" onclick="setAgentStatus('${dId}','active')"><i class="ph-fill ph-play-circle"></i> Restore</button>
                     <button class="adm-action-btn ban" onclick="setAgentStatus('${dId}','banned')"><i class="ph-fill ph-prohibit"></i> Escalate to Ban</button>`;
        } else {
          actions = `<button class="adm-action-btn restore" onclick="setAgentStatus('${dId}','active')"><i class="ph-fill ph-play-circle"></i> Restore</button>`;
        }
        actions += `<button class="adm-action-btn del" onclick="deleteAgent('${dId}','${dName}')"><i class="ph-fill ph-trash"></i> Delete</button>`;

        return `<div class="adm-agent-card">
          <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">
            ${photoEl}
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:.92rem;color:var(--text-primary);margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(a.name||'Unknown')}</div>
              <span class="adm-agent-id">${escapeHtml(a.agentId||'—')}</span>
              <div style="font-size:.75rem;color:var(--text-muted);margin-top:3px">${escapeHtml(a.service||'')}</div>
            </div>
            <span class="agent-status-badge status-${status}">${statusLabel}</span>
          </div>
          <div style="font-size:.75rem;color:var(--text-muted);margin-bottom:8px">${escapeHtml(a.email||'')}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px">
            ${skills.map(s=>`<span class="adm-tag">${escapeHtml(s)}</span>`).join('')}
            ${extra>0?`<span class="adm-tag">+${extra} more</span>`:''}
          </div>
          <div style="font-size:.72rem;color:var(--text-muted);margin-bottom:10px">
            First login: ${a.firstLogin?'<span style="color:#f59e0b">Pending</span>':'<span style="color:#10b981">Complete</span>'}
          </div>
          <div class="adm-agent-actions">${actions}</div>
        </div>`;
      }).join('');
    } catch(e) {
      if (grid) grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;text-align:center;color:#ef4444;font-size:.85rem">Error loading agents: ${escapeHtml(e.message)}</div>`;
    }
  }
  loadAgentsList();

  // Set agent status: 'active' | 'suspended' | 'banned'
  window.setAgentStatus = async (docId, newStatus) => {
    try {
      await db.collection('agents').doc(docId).update({ status: newStatus, active: newStatus === 'active' });
      loadAgentsList();
    } catch(e) { alert('Failed to update status: ' + e.message); }
  };

  // Delete agent permanently
  window.deleteAgent = async (docId, name) => {
    if (!confirm(`Permanently delete agent "${name}"? This cannot be undone.`)) return;
    try {
      await db.collection('agents').doc(docId).delete();
      loadAgentsList();
    } catch(e) { alert('Failed to delete: ' + e.message); }
  };
}

/* ---- CREATE AGENT ---- */
async function renderAdminCreateAgent(el) {
  el.innerHTML = `
  <style>
    .create-agent-panel{display:grid;grid-template-columns:1.6fr 1fr;gap:28px;align-items:start;max-width:1040px}
    @media(max-width:900px){.create-agent-panel{grid-template-columns:1fr}}
    .create-form{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:36px;backdrop-filter:blur(16px)}
    .create-form-step{margin-bottom:30px}
    .create-form-step:last-of-type{margin-bottom:0}
    .step-label{display:flex;align-items:center;gap:10px;margin-bottom:16px}
    .step-num{width:26px;height:26px;border-radius:50%;background:var(--accent-gradient);color:#fff;font-size:.78rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .step-label h4{font-size:1rem;margin:0}
    .agent-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
    @media(max-width:560px){.agent-form-grid{grid-template-columns:1fr}}
    .form-group-sm{margin-bottom:0}
    .form-group-sm label{display:block;font-size:.82rem;font-weight:600;color:var(--text-secondary);margin-bottom:7px}
    .form-group-sm input,.form-group-sm select{width:100%;padding:13px 16px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:.94rem;font-family:inherit;outline:none;color:var(--text-primary);background:rgba(15,23,42,0.03);transition:var(--transition)}
    .form-group-sm input::placeholder{color:var(--text-muted)}
    .form-group-sm input:focus,.form-group-sm select:focus{border-color:var(--accent-1);box-shadow:0 0 0 3px rgba(59,130,246,0.15)}
    .skills-select{width:100%;padding:12px 16px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:.88rem;font-family:inherit;outline:none;height:180px;background:rgba(15,23,42,0.03);color:var(--text-primary)}
    .skills-select:focus{border-color:var(--accent-1)}
    .skills-select option{background:#ffffff;padding:6px}
    .photo-upload-row{display:flex;align-items:center;gap:16px}
    .photo-upload-btn{display:inline-flex;align-items:center;gap:8px;padding:11px 20px;border-radius:var(--radius-sm);border:1.5px dashed var(--border-hover);color:var(--accent-2);font-size:.88rem;font-weight:600;cursor:pointer;transition:var(--transition)}
    .photo-upload-btn:hover{background:rgba(59,130,246,0.08);border-color:var(--accent-1)}
    .create-agent-submit{width:100%;justify-content:center;padding:15px;font-size:1rem;margin-top:32px}
    .created-badge{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.35);border-radius:var(--radius-sm);padding:18px 20px;margin-top:20px;display:none}
    .created-badge code{display:block;font-size:1.15rem;font-weight:700;color:#34d399;letter-spacing:.1em;margin:8px 0;font-family:monospace}
    .agent-side-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:26px}
    .agent-side-card+.agent-side-card{margin-top:20px}
    .agent-side-card h4{font-size:.92rem;margin-bottom:14px;display:flex;align-items:center;gap:8px}
    .agent-side-card h4 i{color:var(--accent-1)}
    .agent-side-card ol,.agent-side-card ul{padding-left:18px;margin:0}
    .agent-side-card li{font-size:.85rem;color:var(--text-secondary);margin-bottom:10px;line-height:1.55}
  </style>

  <div style="display:flex;align-items:center;gap:14px;margin-bottom:28px;flex-wrap:wrap">
    <button class="btn btn-ghost" id="backToAgentListBtn" style="display:flex;align-items:center;gap:6px;padding:8px 14px;flex-shrink:0">
      <i class="ph-fill ph-arrow-left"></i> Agent List
    </button>
    <div>
      <h2 style="margin:0 0 2px">Create New Agent</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin:0">A Firebase login is created for the agent. Share their email and temp password separately — they'll be prompted to change it on first sign-in.</p>
    </div>
  </div>

  <div class="create-agent-panel">
    <div class="create-form">
      <div class="create-form-step">
        <div class="step-label"><span class="step-num">1</span><h4>Basic Information</h4></div>
        <div class="agent-form-grid">
          <div class="form-group-sm"><label>Full Name *</label><input type="text" id="newAgentName" placeholder="e.g. John Doe" /></div>
          <div class="form-group-sm"><label>Email Address *</label><input type="email" id="newAgentEmail" placeholder="agent@example.com" /></div>
          <div class="form-group-sm"><label>Temporary Password *</label><input type="password" id="newAgentPw" placeholder="Min 8 characters" /></div>
          <div class="form-group-sm"><label>Service Area *</label>
            <select id="newAgentService">
              <option value="">— select service —</option>
              ${Object.keys(AGENT_SERVICES_SKILLS).map(s=>`<option value="${s}">${s}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div class="create-form-step">
        <div class="step-label"><span class="step-num">2</span><h4>Skills &amp; Expertise</h4></div>
        <label style="display:block;font-size:.8rem;color:var(--text-muted);margin-bottom:8px">Hold Ctrl/Cmd to select multiple — up to 20 skills</label>
        <select id="newAgentSkills" class="skills-select" multiple></select>
      </div>

      <div class="create-form-step">
        <div class="step-label"><span class="step-num">3</span><h4>Profile Photo <span style="font-weight:400;color:var(--text-muted);font-size:.82rem">(optional)</span></h4></div>
        <div class="photo-upload-row">
          <label class="photo-upload-btn" for="newAgentPhoto"><i class="ph-fill ph-image"></i> Choose photo</label>
          <input type="file" id="newAgentPhoto" accept="image/*" style="display:none" />
          <span id="newAgentPhotoName" style="font-size:.85rem;color:var(--text-muted)">No file selected</span>
        </div>
        <div id="admAgentPhotoProgress" style="font-size:.8rem;color:var(--accent-2);margin-top:10px;display:none"></div>
      </div>

      <div id="admAgentErr" style="color:#f87171;font-size:.85rem;padding:12px 16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-sm);margin-top:24px;display:none"></div>

      <button class="btn btn-primary create-agent-submit" id="createAgentBtn">
        <i class="ph-fill ph-plus"></i> Create Agent
      </button>

      <div class="created-badge" id="agentCreatedBadge">
        <div style="font-weight:700;color:#34d399;margin-bottom:4px">✓ Agent created successfully!</div>
        <div style="font-size:.85rem;color:var(--text-secondary)">Agent ID — give this to the agent for reference:</div>
        <code id="createdAgentId"></code>
        <div style="font-size:.8rem;color:var(--text-muted);margin-bottom:12px">Share their email + temp password separately. They must change it on first login.</div>
        <button class="btn btn-outline" id="viewAgentListBtn" style="font-size:.83rem;display:inline-flex;align-items:center;gap:6px">
          <i class="ph-fill ph-users-three"></i> View Agent List
        </button>
      </div>
    </div>

    <div>
      <div class="agent-side-card">
        <h4><i class="ph-fill ph-info"></i> Before you create an agent</h4>
        <ol>
          <li>Enable Email/Password sign-in in Firebase Console → Authentication → Sign-in method.</li>
          <li>Paste the rules from <strong>FIREBASE_RULES.md</strong> into your Firebase Console — the agent won't save without them.</li>
          <li>Set up Cloudinary under Settings to enable profile photo uploads.</li>
        </ol>
      </div>
      <div class="agent-side-card">
        <h4><i class="ph-fill ph-headset"></i> What happens next</h4>
        <ul>
          <li>The agent signs in at the Agent Portal with their email and temp password.</li>
          <li>They're required to set a new password on first sign-in.</li>
          <li>Once logged in they can update their bio, skills and photo, then start replying to conversations.</li>
        </ul>
      </div>
    </div>
  </div>`;

  document.getElementById('backToAgentListBtn').addEventListener('click', () => {
    document.querySelector('[data-section=adm-agent-list]').click();
  });
  document.getElementById('newAgentPhoto').addEventListener('change', e => {
    document.getElementById('newAgentPhotoName').textContent = e.target.files[0]?.name || 'No file selected';
  });
  document.getElementById('newAgentService').addEventListener('change', e => {
    const skills = AGENT_SERVICES_SKILLS[e.target.value] || [];
    const sel = document.getElementById('newAgentSkills');
    sel.innerHTML = skills.map(s=>`<option value="${s}">${s}</option>`).join('');
  });

  document.getElementById('createAgentBtn').addEventListener('click', async () => {
    const name     = document.getElementById('newAgentName').value.trim();
    const email    = document.getElementById('newAgentEmail').value.trim();
    const pw       = document.getElementById('newAgentPw').value;
    const service  = document.getElementById('newAgentService').value;
    const skillSel = document.getElementById('newAgentSkills');
    const skills   = Array.from(skillSel.selectedOptions).map(o=>o.value);
    const photoFile = document.getElementById('newAgentPhoto').files[0];
    const errEl    = document.getElementById('admAgentErr');
    const badge    = document.getElementById('agentCreatedBadge');
    const btn      = document.getElementById('createAgentBtn');
    errEl.style.display='none'; badge.style.display='none';

    if (!name||!email||!pw||!service) { errEl.textContent='Please fill in all required fields.'; errEl.style.display=''; return; }
    if (pw.length<8) { errEl.textContent='Password must be at least 8 characters.'; errEl.style.display=''; return; }
    btn.disabled=true; btn.innerHTML='<i class="ph-fill ph-spinner"></i> Creating…';

    // Write the Firestore doc BEFORE creating the Auth login so we can roll back on failure.
    let docRef = null;
    try {
      let photoUrl = '';
      if (photoFile) {
        const progressEl = document.getElementById('admAgentPhotoProgress');
        progressEl.style.display=''; progressEl.textContent='Uploading photo…';
        try { photoUrl = await uploadToCloudinary(photoFile); progressEl.textContent='✓ Photo uploaded'; }
        catch(e) { progressEl.textContent='Photo upload failed: '+e.message; }
      }

      const agentId = await generateAgentId();
      docRef = db.collection('agents').doc();
      await docRef.set({
        agentId, uid: null, name, email, service, skills, photoUrl,
        bio: '', status: 'active', active: true, firstLogin: true, createdAt: TS()
      });

      // Create the Firebase Auth login via a secondary app so the admin stays signed in.
      const creatorApp  = getAgentCreatorApp();
      const creatorAuth = creatorApp.auth();
      const cred = await creatorAuth.createUserWithEmailAndPassword(email, pw);
      const uid  = cred.user.uid;
      await creatorAuth.signOut();
      await docRef.update({ uid });

      document.getElementById('createdAgentId').textContent = agentId;
      badge.style.display='';
      ['newAgentName','newAgentEmail','newAgentPw'].forEach(id => document.getElementById(id).value='');
      document.getElementById('newAgentService').value='';
      document.getElementById('newAgentSkills').innerHTML='';
      document.getElementById('newAgentPhoto').value='';
      document.getElementById('newAgentPhotoName').textContent='No file selected';
      document.getElementById('viewAgentListBtn').addEventListener('click', () => {
        document.querySelector('[data-section=adm-agent-list]').click();
      });
    } catch(e) {
      if (docRef) { await docRef.delete().catch(()=>{}); }
      if (e.code==='auth/email-already-in-use') {
        errEl.textContent='An account with this email already exists. Use a different email or delete the existing agent first.';
      } else if (e.code==='auth/operation-not-allowed') {
        errEl.textContent='Email/Password sign-in is disabled. In Firebase console → Authentication → Sign-in method, enable "Email/Password".';
      } else if (e.code==='permission-denied'||/permission/i.test(e.message||'')) {
        errEl.textContent='Firestore rejected the save (permission denied). Make sure the rules in FIREBASE_RULES.md are applied in your Firebase console.';
      } else {
        errEl.textContent = e.message||'Something went wrong. Please try again.';
      }
      errEl.style.display='';
    }
    btn.disabled=false; btn.innerHTML='<i class="ph-fill ph-plus"></i> Create Agent';
  });
}

/* ---- SETTINGS (Cloudinary, etc.) ---- */
async function renderAdminSettings(el) {
  el.innerHTML = '<h2>Settings</h2><p style="color:var(--text-muted)">Loading…</p>';
  let cfg = {};
  try {
    const doc = await db.collection('settings').doc('cloudinary').get();
    if (doc.exists) cfg = doc.data();
  } catch (e) { console.warn('Settings load:', e.message); }

  el.innerHTML = `
  <h2>Settings</h2>
  <p style="color:var(--text-muted);margin-bottom:24px">Configuration used by the seller/buyer marketplace pages.</p>
  <div class="glass-card" style="padding:24px;max-width:520px">
    <h4 style="margin-bottom:4px">Cloudinary (image uploads)</h4>
    <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:16px">Used for seller profile pictures and gig images. Find these in your Cloudinary dashboard — cloud name on the main page, and create an "unsigned" upload preset under Settings &gt; Upload.</p>
    <div class="form-group"><label>Cloud name</label><input type="text" id="admCloudName" value="${cfg.cloudName || ''}" placeholder="e.g. darapet" /></div>
    <div class="form-group"><label>Unsigned upload preset name</label><input type="text" id="admUploadPreset" value="${cfg.uploadPreset || ''}" placeholder="e.g. darapet_unsigned" /></div>
    <div id="admSettingsErr" style="color:#ef4444;font-size:.82rem;margin-bottom:12px;display:none"></div>
    <div id="admSettingsOk" style="color:#10b981;font-size:.82rem;margin-bottom:12px;display:none">Saved!</div>
    <button class="btn btn-primary" id="admSettingsSave">Save Settings</button>
  </div>`;

  document.getElementById('admSettingsSave').addEventListener('click', async () => {
    const errEl = document.getElementById('admSettingsErr');
    const okEl  = document.getElementById('admSettingsOk');
    errEl.style.display = 'none'; okEl.style.display = 'none';
    const cloudName = document.getElementById('admCloudName').value.trim();
    const uploadPreset = document.getElementById('admUploadPreset').value.trim();
    if (!cloudName || !uploadPreset) { errEl.textContent = 'Please fill both fields'; errEl.style.display = ''; return; }
    const btn = document.getElementById('admSettingsSave');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await db.collection('settings').doc('cloudinary').set({ cloudName, uploadPreset, updatedAt: TS() }, { merge: true });
      okEl.style.display = '';
    } catch (e) {
      errEl.textContent = e.message; errEl.style.display = '';
    }
    btn.disabled = false; btn.textContent = 'Save Settings';
  });
}

/* ---- OVERVIEW ---- */
async function renderAdminOverview(el) {
  el.innerHTML = `<p style="color:var(--text-muted);padding:32px">Loading overview…</p>`;

  const [contacts, portfolio, testimonials, newsletter, pricing, agents, conversations] = await Promise.all([
    db.collection('contacts').where('status','==','new').get(),
    db.collection('portfolio').get(),
    db.collection('testimonials').get(),
    db.collection('newsletter').where('active','==',true).get(),
    db.collection('pricing_inquiries').where('status','==','pending').get(),
    db.collection('agents').get(),
    db.collection('conversations').get()
  ]);

  const unread = contacts.size;
  const badge = document.getElementById('unreadBadge');
  if (badge) badge.textContent = unread;

  // Agent breakdown
  let agentActive = 0, agentSuspended = 0, agentBanned = 0;
  agents.docs.forEach(d => {
    const a = d.data();
    const st = a.status || (a.active === false ? 'suspended' : 'active');
    if (st === 'active') agentActive++;
    else if (st === 'suspended') agentSuspended++;
    else if (st === 'banned') agentBanned++;
  });

  // Conversation breakdown
  let convOpen = 0, convResolved = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  let convToday = 0;
  conversations.docs.forEach(d => {
    const c = d.data();
    if (c.status === 'resolved' || c.status === 'closed') convResolved++;
    else convOpen++;
    const ts = c.createdAt?.toDate ? c.createdAt.toDate() : null;
    if (ts && ts >= today) convToday++;
  });

  el.innerHTML = `
  <style>
    .ov-section-label{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--text-muted);margin:32px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--border)}
    .ov-section-label:first-of-type{margin-top:0}
    .ov-stats{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:0}
    .ov-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px 22px;transition:border-color .15s}
    .ov-card:hover{border-color:var(--border-hover)}
    .ov-num{font-size:2rem;font-weight:800;font-family:'Space Grotesk',sans-serif;line-height:1;margin-bottom:4px}
    .ov-lbl{font-size:.78rem;color:var(--text-muted);font-weight:500}
    .ov-accent-green .ov-num{color:#10b981}
    .ov-accent-yellow .ov-num{color:#f59e0b}
    .ov-accent-red .ov-num{color:#ef4444}
    .ov-accent-blue .ov-num{color:#60a5fa}
    .ov-accent-purple .ov-num{color:#a78bfa}
    .ov-qa{display:flex;gap:10px;flex-wrap:wrap;margin-top:28px}
  </style>

  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;flex-wrap:wrap;gap:12px">
    <div>
      <h2 style="margin:0 0 4px">Overview</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin:0">Live snapshot from Firebase — refreshes every time you open this page.</p>
    </div>
    <button class="btn btn-outline" style="display:flex;align-items:center;gap:6px;font-size:.83rem" onclick="renderAdminOverview(document.getElementById('adm-overview'))">
      <i class="ph-fill ph-arrow-clockwise"></i> Refresh
    </button>
  </div>

  <div class="ov-section-label">Conversations</div>
  <div class="ov-stats">
    <div class="ov-card ov-accent-blue"><div class="ov-num">${conversations.size}</div><div class="ov-lbl">Total Conversations</div></div>
    <div class="ov-card ov-accent-yellow"><div class="ov-num">${convOpen}</div><div class="ov-lbl">Open / Pending</div></div>
    <div class="ov-card ov-accent-green"><div class="ov-num">${convResolved}</div><div class="ov-lbl">Resolved</div></div>
    <div class="ov-card ov-accent-purple"><div class="ov-num">${convToday}</div><div class="ov-lbl">Started Today</div></div>
  </div>

  <div class="ov-section-label">Agents</div>
  <div class="ov-stats">
    <div class="ov-card ov-accent-green"><div class="ov-num">${agentActive}</div><div class="ov-lbl">Active Agents</div></div>
    <div class="ov-card ov-accent-yellow"><div class="ov-num">${agentSuspended}</div><div class="ov-lbl">Suspended</div></div>
    <div class="ov-card ov-accent-red"><div class="ov-num">${agentBanned}</div><div class="ov-lbl">Banned</div></div>
  </div>

  <div class="ov-section-label">Content &amp; Leads</div>
  <div class="ov-stats">
    <div class="ov-card"><div class="ov-num">${unread}</div><div class="ov-lbl">Unread Messages</div></div>
    <div class="ov-card"><div class="ov-num">${pricing.size}</div><div class="ov-lbl">Pending Quotes</div></div>
    <div class="ov-card"><div class="ov-num">${newsletter.size}</div><div class="ov-lbl">Subscribers</div></div>
    <div class="ov-card"><div class="ov-num">${portfolio.size}</div><div class="ov-lbl">Portfolio Items</div></div>
    <div class="ov-card"><div class="ov-num">${testimonials.size}</div><div class="ov-lbl">Testimonials</div></div>
  </div>

  <div class="ov-qa">
    <button class="btn btn-outline" onclick="document.querySelector('[data-section=adm-customers]').click()"><i class="ph-fill ph-identification-card"></i> View Customers</button>
    <button class="btn btn-outline" onclick="document.querySelector('[data-section=adm-messages]').click()"><i class="ph-fill ph-inbox"></i> Check Messages</button>
    <button class="btn btn-outline" onclick="document.querySelector('[data-section=adm-agent-list]').click()"><i class="ph-fill ph-users-three"></i> Manage Agents</button>
    <button class="btn btn-outline" onclick="document.querySelector('[data-section=adm-portfolio]').click()"><i class="ph-fill ph-images"></i> Portfolio</button>
  </div>`;
}

/* ---- MESSAGES ---- */
async function renderAdminMessages(el) {
  el.innerHTML = '<h2>Messages</h2><p style="color:var(--text-muted)">Loading…</p>';
  const snap = await db.collection('contacts').orderBy('createdAt','desc').get();
  if (snap.empty) { el.innerHTML = '<h2>Messages</h2><p style="color:var(--text-muted)">No messages yet.</p>'; return; }

  const rows = snap.docs.map(doc => {
    const m = doc.data();
    const ts = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString() : '—';
    const services = Array.isArray(m.services) ? m.services.join(', ') : (m.service||'—');
    return `<div class="inbox-row ${m.status==='new'?'unread':''}" data-id="${doc.id}">
      <div><strong>${escapeHtml(m.name||'—')}</strong><small>${escapeHtml(m.email||'')}</small></div>
      <div><span class="inbox-tag">${escapeHtml(services.slice(0,30))}</span></div>
      <div>${escapeHtml((m.message||'').slice(0,100))}…</div>
      <div><small>${ts}</small></div>
      <div>
        <span class="status-badge ${m.status==='new'?'status-new':m.status==='replied'?'status-replied':''}">${m.status||'new'}</span>
        <button onclick="markContactStatus('${doc.id}','replied',this)" style="margin-left:6px;font-size:.72rem;background:none;border:1px solid var(--border);border-radius:6px;padding:2px 8px;cursor:pointer;color:var(--text-secondary)">✓ Reply</button>
        <button onclick="deleteContact('${doc.id}',this)" style="margin-left:4px;font-size:.72rem;background:none;border:1px solid #ef4444;border-radius:6px;padding:2px 8px;cursor:pointer;color:#ef4444">×</button>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `<h2>Message Inbox</h2>
  <div class="glass-card" style="padding:0;overflow:hidden">
    <div class="inbox-header"><span>From</span><span>Service</span><span>Message</span><span>Date</span><span>Status</span></div>
    <div id="admInboxRows">${rows}</div>
  </div>`;
}

window.markContactStatus = async (id, status, btn) => {
  await db.collection('contacts').doc(id).update({ status });
  const row = btn.closest('.inbox-row');
  if (row) { row.classList.remove('unread'); const badge = row.querySelector('.status-badge'); if(badge) { badge.className='status-badge '+(status==='replied'?'status-replied':''); badge.textContent=status; } }
};
window.deleteContact = async (id, btn) => {
  if (!confirm('Delete this message?')) return;
  await db.collection('contacts').doc(id).delete();
  btn.closest('.inbox-row')?.remove();
};

/* ---- NEWSLETTER ---- */
async function renderAdminNewsletter(el) {
  el.innerHTML = '<h2>Newsletter</h2><p style="color:var(--text-muted)">Loading…</p>';
  const snap = await db.collection('newsletter').orderBy('createdAt','desc').get();
  const rows = snap.docs.map(doc => {
    const d = doc.data();
    const ts = d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString() : '—';
    return `<tr><td>${escapeHtml(d.email)}</td><td><span style="color:${d.active?'#10b981':'#ef4444'}">${d.active?'Active':'Unsubscribed'}</span></td><td>${ts}</td>
      <td><button onclick="deleteNewsletterSub('${doc.id}',this)" style="background:none;border:1px solid #ef4444;border-radius:6px;padding:2px 8px;cursor:pointer;font-size:.75rem;color:#ef4444">Remove</button></td></tr>`;
  }).join('');

  el.innerHTML = `<h2>Newsletter Subscribers <span style="font-size:1rem;font-weight:400;color:var(--text-muted)">(${snap.size})</span></h2>
  <div class="glass-card" style="padding:0;overflow:hidden">
    <table style="width:100%;border-collapse:collapse;font-size:.88rem">
      <thead><tr style="background:rgba(56,189,248,.05);font-size:.75rem;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted)"><th style="padding:12px 20px;text-align:left">Email</th><th>Status</th><th>Joined</th><th>Action</th></tr></thead>
      <tbody id="nlRows">${rows||'<tr><td colspan="4" style="padding:20px;text-align:center;color:var(--text-muted)">No subscribers yet.</td></tr>'}</tbody>
    </table>
  </div>`;
}
window.deleteNewsletterSub = async (id, btn) => {
  if (!confirm('Remove subscriber?')) return;
  await db.collection('newsletter').doc(id).delete();
  btn.closest('tr')?.remove();
};

/* ---- PORTFOLIO ---- */
async function renderAdminPortfolio(el) {
  el.innerHTML = '<h2>Portfolio</h2><p style="color:var(--text-muted)">Loading…</p>';
  const snap = await db.collection('portfolio').orderBy('sortOrder').get();
  const items = snap.docs.map(d => ({ id:d.id, ...d.data() }));

  el.innerHTML = `<h2>Portfolio Manager</h2>
  <button class="btn btn-primary" style="margin-bottom:20px" id="addPortfolioBtn"><i class="ph-fill ph-plus"></i> Add Project</button>
  <div id="portfolioList">${items.map(p => portfolioCard(p)).join('') || '<p style="color:var(--text-muted)">No projects yet. Add one above.</p>'}</div>
  <div id="portfolioFormWrap" style="display:none"></div>`;

  document.getElementById('addPortfolioBtn').addEventListener('click', () => showPortfolioForm(null));
}

function portfolioCard(p) {
  return `<div class="glass-card" style="padding:20px;margin-bottom:12px;display:flex;gap:16px;align-items:center" data-pid="${p.id}">
    <div style="flex:1">
      <strong>${escapeHtml(p.title)}</strong>
      <span style="margin-left:10px;font-size:.78rem;background:rgba(56,189,248,.1);color:var(--accent-1);padding:2px 10px;border-radius:100px">${escapeHtml(p.category)}</span>
      ${p.featured?'<span style="margin-left:6px;font-size:.75rem;color:#f59e0b">★ Featured</span>':''}
      <p style="color:var(--text-muted);font-size:.83rem;margin:4px 0 0">${escapeHtml((p.description||'').slice(0,80))}${(p.description||'').length>80?'…':''}</p>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0">
      <button onclick="showPortfolioForm('${p.id}')" class="btn btn-outline" style="font-size:.8rem;padding:6px 14px">Edit</button>
      <button onclick="deletePortfolioItem('${p.id}',this)" class="btn" style="font-size:.8rem;padding:6px 14px;border:1px solid #ef4444;color:#ef4444;background:none;border-radius:8px">Delete</button>
    </div>
  </div>`;
}

window.showPortfolioForm = async (id) => {
  const wrap = document.getElementById('portfolioFormWrap');
  let data = { title:'', description:'', category:'Web Development', imageUrl:'', projectUrl:'', tags:'', featured:false, sortOrder:0 };
  if (id) {
    const doc = await db.collection('portfolio').doc(id).get();
    if (doc.exists) data = { ...data, ...doc.data(), tags: (doc.data().tags||[]).join(', ') };
  }
  wrap.style.display = '';
  wrap.innerHTML = `<div class="glass-card" style="padding:28px;margin-top:8px">
    <h3 style="margin-bottom:20px">${id ? 'Edit' : 'New'} Project</h3>
    <div class="fl-row">
      <div class="fl-group"><input class="fl-input" id="pf-title" placeholder=" " value="${escapeHtml(data.title)}" /><label class="fl-label">Title *</label></div>
      <div class="fl-group"><input class="fl-input" id="pf-category" placeholder=" " value="${escapeHtml(data.category)}" /><label class="fl-label">Category *</label></div>
    </div>
    <div class="fl-group"><textarea class="fl-textarea" id="pf-desc" placeholder=" ">${escapeHtml(data.description)}</textarea><label class="fl-label">Description *</label></div>
    <div class="fl-row">
      <div class="fl-group"><input class="fl-input" id="pf-img" placeholder=" " value="${escapeHtml(data.imageUrl||'')}" /><label class="fl-label">Image URL</label></div>
      <div class="fl-group"><input class="fl-input" id="pf-url" placeholder=" " value="${escapeHtml(data.projectUrl||'')}" /><label class="fl-label">Project URL</label></div>
    </div>
    <div class="fl-row">
      <div class="fl-group"><input class="fl-input" id="pf-tags" placeholder=" " value="${escapeHtml(data.tags||'')}" /><label class="fl-label">Tags (comma separated)</label></div>
      <div class="fl-group"><input class="fl-input" type="number" id="pf-order" placeholder=" " value="${data.sortOrder||0}" /><label class="fl-label">Sort Order</label></div>
    </div>
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:20px">
      <input type="checkbox" id="pf-featured" ${data.featured?'checked':''} style="width:16px;height:16px"> Featured project
    </label>
    <div style="display:flex;gap:10px">
      <button class="btn btn-primary" id="pfSaveBtn">Save Project</button>
      <button class="btn btn-ghost" onclick="document.getElementById('portfolioFormWrap').style.display='none'">Cancel</button>
    </div>
    <div id="pfErr" style="color:#ef4444;margin-top:10px;font-size:.83rem;display:none"></div>
  </div>`;

  document.getElementById('pfSaveBtn').addEventListener('click', async () => {
    const saveData = {
      title:       document.getElementById('pf-title').value.trim(),
      description: document.getElementById('pf-desc').value.trim(),
      category:    document.getElementById('pf-category').value.trim(),
      imageUrl:    document.getElementById('pf-img').value.trim(),
      projectUrl:  document.getElementById('pf-url').value.trim(),
      tags:        document.getElementById('pf-tags').value.split(',').map(s=>s.trim()).filter(Boolean),
      sortOrder:   parseInt(document.getElementById('pf-order').value)||0,
      featured:    document.getElementById('pf-featured').checked,
    };
    const errEl = document.getElementById('pfErr');
    if (!saveData.title || !saveData.description || !saveData.category) { errEl.textContent='Title, description and category are required.'; errEl.style.display=''; return; }
    if (id) {
      await db.collection('portfolio').doc(id).update(saveData);
    } else {
      await db.collection('portfolio').add({ ...saveData, createdAt:TS() });
    }
    wrap.style.display='none';
    // Reload the section
    const sec = document.getElementById('adm-portfolio');
    delete sec.dataset.loaded;
    renderAdminPortfolio(sec);
  });
};

window.deletePortfolioItem = async (id, btn) => {
  if (!confirm('Delete this project?')) return;
  await db.collection('portfolio').doc(id).delete();
  btn.closest('[data-pid]')?.remove();
};

/* ---- TESTIMONIALS ---- */
async function renderAdminTestimonials(el) {
  el.innerHTML = '<h2>Testimonials</h2><p style="color:var(--text-muted)">Loading…</p>';
  const snap = await db.collection('testimonials').orderBy('createdAt','desc').get();
  const items = snap.docs.map(d => ({ id:d.id, ...d.data() }));

  el.innerHTML = `<h2>Testimonials Manager</h2>
  <button class="btn btn-primary" style="margin-bottom:20px" id="addTestBtn"><i class="ph-fill ph-plus"></i> Add Testimonial</button>
  <div id="testList">${items.map(t => testimonialCard(t)).join('') || '<p style="color:var(--text-muted)">No testimonials yet.</p>'}</div>
  <div id="testFormWrap" style="display:none"></div>`;

  document.getElementById('addTestBtn').addEventListener('click', () => showTestimonialForm(null));
}

function testimonialCard(t) {
  return `<div class="glass-card" style="padding:18px;margin-bottom:10px;display:flex;gap:14px;align-items:flex-start" data-tid="${t.id}">
    <div style="flex:1">
      <strong>${escapeHtml(t.name)}</strong> · <span style="color:var(--text-muted);font-size:.83rem">${escapeHtml(t.role)}${t.company?', '+escapeHtml(t.company):''}</span>
      ${'★'.repeat(t.rating||5)}
      <p style="font-size:.85rem;color:var(--text-secondary);margin:4px 0 0">"${escapeHtml((t.content||'').slice(0,100))}${(t.content||'').length>100?'…':''}"</p>
      <span style="font-size:.75rem;color:${t.active?'#10b981':'#ef4444'}">${t.active?'Visible':'Hidden'}</span>
    </div>
    <div style="display:flex;gap:8px;flex-shrink:0">
      <button onclick="showTestimonialForm('${t.id}')" class="btn btn-outline" style="font-size:.8rem;padding:6px 14px">Edit</button>
      <button onclick="deleteTestimonial('${t.id}',this)" class="btn" style="font-size:.8rem;padding:6px 14px;border:1px solid #ef4444;color:#ef4444;background:none;border-radius:8px">Delete</button>
    </div>
  </div>`;
}

window.showTestimonialForm = async (id) => {
  const wrap = document.getElementById('testFormWrap');
  let data = { name:'', role:'', company:'', content:'', rating:5, avatarInitials:'', active:true };
  if (id) {
    const doc = await db.collection('testimonials').doc(id).get();
    if (doc.exists) data = { ...data, ...doc.data() };
  }
  wrap.style.display='';
  wrap.innerHTML = `<div class="glass-card" style="padding:28px;margin-top:8px">
    <h3 style="margin-bottom:20px">${id?'Edit':'New'} Testimonial</h3>
    <div class="fl-row">
      <div class="fl-group"><input class="fl-input" id="tf-name" placeholder=" " value="${escapeHtml(data.name)}" /><label class="fl-label">Name *</label></div>
      <div class="fl-group"><input class="fl-input" id="tf-role" placeholder=" " value="${escapeHtml(data.role)}" /><label class="fl-label">Role *</label></div>
    </div>
    <div class="fl-row">
      <div class="fl-group"><input class="fl-input" id="tf-company" placeholder=" " value="${escapeHtml(data.company||'')}" /><label class="fl-label">Company</label></div>
      <div class="fl-group"><input class="fl-input" id="tf-initials" placeholder=" " value="${escapeHtml(data.avatarInitials||'')}" /><label class="fl-label">Avatar Initials</label></div>
    </div>
    <div class="fl-group"><textarea class="fl-textarea" id="tf-content" placeholder=" ">${escapeHtml(data.content)}</textarea><label class="fl-label">Testimonial *</label></div>
    <div class="fl-row">
      <div class="fl-group"><input class="fl-input" type="number" id="tf-rating" min="1" max="5" placeholder=" " value="${data.rating||5}" /><label class="fl-label">Rating (1–5)</label></div>
      <div style="display:flex;align-items:center;gap:10px;flex:1">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="tf-active" ${data.active?'checked':''} style="width:16px;height:16px"> Show publicly
        </label>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:12px">
      <button class="btn btn-primary" id="tfSaveBtn">Save</button>
      <button class="btn btn-ghost" onclick="document.getElementById('testFormWrap').style.display='none'">Cancel</button>
    </div>
  </div>`;

  document.getElementById('tfSaveBtn').addEventListener('click', async () => {
    const d = {
      name:           document.getElementById('tf-name').value.trim(),
      role:           document.getElementById('tf-role').value.trim(),
      company:        document.getElementById('tf-company').value.trim(),
      content:        document.getElementById('tf-content').value.trim(),
      avatarInitials: document.getElementById('tf-initials').value.trim(),
      rating:         parseInt(document.getElementById('tf-rating').value)||5,
      active:         document.getElementById('tf-active').checked,
    };
    if (!d.name || !d.role || !d.content) { alert('Name, role and content are required.'); return; }
    if (id) { await db.collection('testimonials').doc(id).update(d); }
    else    { await db.collection('testimonials').add({ ...d, createdAt:TS() }); }
    wrap.style.display='none';
    const sec = document.getElementById('adm-testimonials');
    renderAdminTestimonials(sec);
  });
};

window.deleteTestimonial = async (id, btn) => {
  if (!confirm('Delete this testimonial?')) return;
  await db.collection('testimonials').doc(id).delete();
  btn.closest('[data-tid]')?.remove();
};

/* ---- LIVE STATS ---- */
async function renderAdminStats(el) {
  el.innerHTML = '<h2>Live Stats</h2><p style="color:var(--text-muted)">Loading…</p>';
  const snap = await db.collection('stats').get();
  const stats = {};
  snap.forEach(doc => { stats[doc.id] = doc.data(); });

  const defaults = [
    { key:'projects',    label:'Projects Completed', unit:'+' },
    { key:'clients',     label:'Happy Clients',       unit:'+' },
    { key:'years',       label:'Years Active',         unit:'+' },
    { key:'satisfaction',label:'Satisfaction Rate',    unit:'%' },
  ];

  el.innerHTML = `<h2>Live Stats Editor</h2>
  <p style="color:var(--text-muted);margin-bottom:20px">These numbers appear on the homepage and contact page.</p>
  <div class="glass-card" style="padding:28px">
    ${defaults.map(s => `
    <div class="fl-row" style="align-items:center;margin-bottom:16px">
      <div style="flex:1.5;font-weight:600">${s.label} <span style="color:var(--text-muted)">(${s.unit})</span></div>
      <div class="fl-group" style="flex:1;margin-bottom:0">
        <input class="fl-input" type="number" id="stat-${s.key}" placeholder=" " value="${stats[s.key]?.value ?? ''}" />
        <label class="fl-label">Value</label>
      </div>
    </div>`).join('')}
    <button class="btn btn-primary" id="saveStatsBtn" style="margin-top:8px"><i class="ph-fill ph-floppy-disk"></i> Save All Stats</button>
    <div id="statsMsg" style="margin-top:10px;font-size:.83rem;display:none"></div>
  </div>`;

  document.getElementById('saveStatsBtn').addEventListener('click', async () => {
    const btn = document.getElementById('saveStatsBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await Promise.all(defaults.map(s => {
        const val = parseInt(document.getElementById(`stat-${s.key}`).value);
        if (isNaN(val)) return Promise.resolve();
        return db.collection('stats').doc(s.key).set({ value:val, label:s.label }, { merge:true });
      }));
      const msg = document.getElementById('statsMsg');
      msg.textContent = '✓ Stats saved! They will appear on the live site.';
      msg.style.color = '#10b981';
      msg.style.display = '';
      setTimeout(() => { msg.style.display='none'; }, 3000);
    } catch(e) { alert('Error saving stats: ' + e.message); }
    finally { btn.disabled=false; btn.innerHTML='<i class="ph-fill ph-floppy-disk"></i> Save All Stats'; }
  });
}

/* ---- PRICING INQUIRIES ---- */
async function renderAdminPricing(el) {
  el.innerHTML = '<h2>Pricing Inquiries</h2><p style="color:var(--text-muted)">Loading…</p>';
  const snap = await db.collection('pricing_inquiries').orderBy('createdAt','desc').get();
  if (snap.empty) { el.innerHTML = '<h2>Pricing Inquiries</h2><p style="color:var(--text-muted)">No inquiries yet.</p>'; return; }

  const rows = snap.docs.map(doc => {
    const m = doc.data();
    const ts = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleDateString() : '—';
    const statusColors = { pending:'#f59e0b', contacted:'#10b981', closed:'#6b7280' };
    return `<div class="glass-card" style="padding:18px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
        <div>
          <strong>${escapeHtml(m.name)}</strong> · <a href="mailto:${escapeHtml(m.email)}" style="color:var(--accent-1)">${escapeHtml(m.email)}</a>
          <div style="font-size:.82rem;color:var(--text-muted);margin:4px 0">Service: ${escapeHtml(m.service)} · Budget: ${escapeHtml(m.budget||'Not specified')}</div>
          <p style="font-size:.85rem;color:var(--text-secondary);margin:4px 0">${escapeHtml((m.description||'').slice(0,150))}${(m.description||'').length>150?'…':''}</p>
          <small style="color:var(--text-muted)">${ts}</small>
        </div>
        <div style="flex-shrink:0">
          <select onchange="updatePricingStatus('${doc.id}',this.value)" style="background:var(--bg-card);color:var(--text-primary);border:1px solid var(--border);border-radius:8px;padding:4px 10px;font-size:.8rem">
            <option ${m.status==='pending'?'selected':''}>pending</option>
            <option ${m.status==='contacted'?'selected':''}>contacted</option>
            <option ${m.status==='closed'?'selected':''}>closed</option>
          </select>
        </div>
      </div>
    </div>`;
  }).join('');
  el.innerHTML = `<h2>Pricing Inquiries <span style="font-size:1rem;font-weight:400;color:var(--text-muted)">(${snap.size})</span></h2>${rows}`;
}
window.updatePricingStatus = (id, status) => db.collection('pricing_inquiries').doc(id).update({ status });

/* ---- LIVE CHAT (admin reply panel) ---- */
let admChatUnsub = null;

async function renderAdminChat(el) {
  if (admChatUnsub) { admChatUnsub(); admChatUnsub = null; }
  el.innerHTML = '<h2>Live Chat</h2><p style="color:var(--text-muted)">Loading rooms…</p>';
  const roomsSnap = await db.collection('chat_rooms').orderBy('createdAt','desc').get();
  if (roomsSnap.empty) {
    el.innerHTML = `<h2>Live Chat</h2><p style="color:var(--text-muted)">No chat rooms yet. Visitors create rooms when they start a chat.</p>`;
    return;
  }
  const rooms = roomsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  el.innerHTML = `
  <h2>Live Chat</h2>
  <div style="display:flex;gap:20px;height:70vh;min-height:400px">
    <div class="glass-card" style="width:230px;flex-shrink:0;padding:0;overflow-y:auto;border-radius:12px">
      <div style="padding:10px 16px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);border-bottom:1px solid var(--border)">Rooms</div>
      <div id="admChatRoomList">
        ${rooms.map(r => {
          const ts = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : '';
          return `<div class="adm-room-item" data-id="${r.id}"
            style="padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s"
            onclick="admOpenRoom('${r.id}','${escapeHtml(r.name||r.id)}')">
            <strong style="font-size:.85rem;display:block">${escapeHtml(r.name||r.id)}</strong>
            <small style="color:var(--text-muted)">${ts}</small>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="glass-card" style="flex:1;display:flex;flex-direction:column;padding:0;overflow:hidden;border-radius:12px">
      <div id="admChatPanel" style="display:flex;flex-direction:column;height:100%">
        <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">
          <div style="text-align:center">
            <i class="ph-fill ph-chat-circle-dots" style="font-size:2.8rem;opacity:.25;display:block;margin-bottom:8px"></i>
            Select a room to start replying
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

window.admOpenRoom = (roomId, roomName) => {
  document.querySelectorAll('.adm-room-item').forEach(r => {
    r.style.background = r.dataset.id === roomId ? 'rgba(56,189,248,0.1)' : '';
  });
  if (admChatUnsub) { admChatUnsub(); admChatUnsub = null; }

  const panel = document.getElementById('admChatPanel');
  panel.innerHTML = `
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);font-weight:600;flex-shrink:0">${escapeHtml(roomName)}</div>
    <div id="admMsgList" style="flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px"></div>
    <div style="padding:12px 16px;border-top:1px solid var(--border);display:flex;gap:10px;flex-shrink:0">
      <input id="admChatInput" type="text" placeholder="Reply as Admin…"
        style="flex:1;padding:10px 14px;border-radius:8px;background:var(--bg-card);border:1px solid var(--border);color:inherit;outline:none" />
      <button id="admChatSend" class="btn btn-primary" style="padding:10px 20px">Send</button>
    </div>`;

  const msgList = panel.querySelector('#admMsgList');

  admChatUnsub = db.collection('chat_messages')
    .where('roomId', '==', roomId)
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      msgList.innerHTML = snap.docs.map(d => {
        const m = d.data();
        const ts = m.createdAt?.toDate
          ? m.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';
        const isAdmin = m.username === 'Admin';
        return `<div style="display:flex;flex-direction:column;align-items:${isAdmin ? 'flex-end' : 'flex-start'}">
          <div style="max-width:72%;background:${isAdmin ? 'linear-gradient(135deg,#38bdf8,#818cf8)' : 'var(--bg-card)'};color:${isAdmin ? '#fff' : 'inherit'};border:1px solid var(--border);border-radius:12px;padding:10px 14px;font-size:.88rem">
            ${escapeHtml(m.content || '')}
          </div>
          <span style="font-size:.72rem;color:var(--text-muted);margin-top:4px">${isAdmin ? 'Admin' : escapeHtml(m.username || 'User')} · ${ts}</span>
        </div>`;
      }).join('');
      msgList.scrollTop = msgList.scrollHeight;
    });

  const sendMsg = async () => {
    const inp = panel.querySelector('#admChatInput');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    await db.collection('chat_messages').add({
      roomId, userId: 'admin', username: 'Admin',
      content: text, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  };
  panel.querySelector('#admChatSend').addEventListener('click', sendMsg);
  panel.querySelector('#admChatInput').addEventListener('keypress', e => { if (e.key === 'Enter') sendMsg(); });
};

/* ---- SOCIAL LINKS (localStorage — same as before) ---- */
function loadAdminSocials() {}
function renderAdminSocials(el) {
  el.innerHTML = document.getElementById('socials')?.innerHTML || `
  <h2>Social Links</h2>
  <p style="color:var(--text-muted);margin-bottom:20px">Changes are saved in your browser and applied sitewide.</p>
  <form id="socialSettingsForm" class="glass-card" style="padding:32px">
    ${[['admin-facebook','Facebook','fab fa-facebook-f','https://facebook.com/yourpage'],
       ['admin-instagram','Instagram','fab fa-instagram','https://instagram.com/yourprofile'],
       ['admin-twitter','X (Twitter)','fab fa-x-twitter','https://x.com/yourhandle'],
       ['admin-tiktok','TikTok','fab fa-tiktok','https://tiktok.com/@yourhandle'],
       ['admin-linkedin','LinkedIn','fab fa-linkedin-in','https://linkedin.com/in/yourprofile'],
       ['admin-fiverr','Fiverr','ph-fill ph-stack','https://fiverr.com/yourprofile'],
       ['admin-upwork','Upwork','ph-fill ph-briefcase','https://upwork.com/freelancers/yourprofile'],
      ].map(([id,label,icon,ph]) => `<div class="form-group">
        <label for="${id}"><i class="${icon}" style="margin-right:8px"></i>${label}</label>
        <input type="url" id="${id}" placeholder="${ph}" value="${localStorage.getItem(id)||''}" />
      </div>`).join('')}
    <div class="save-btn-wrap">
      <button type="submit" class="btn btn-primary btn-lg"><i class="ph-fill ph-floppy-disk"></i> Save All Social Links</button>
    </div>
  </form>`;

  document.getElementById('socialSettingsForm')?.addEventListener('submit', e => {
    e.preventDefault();
    ['admin-facebook','admin-instagram','admin-twitter','admin-tiktok','admin-linkedin','admin-fiverr','admin-upwork'].forEach(id => {
      const val = document.getElementById(id)?.value;
      if (val !== null) localStorage.setItem(id, val);
    });
    alert('Social links saved!');
  });
}

/* ================================================================
   PAGE BOOTSTRAP
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // Stats on any page that shows counters
  if (document.querySelector('.count[data-target], .big-count[data-target]')) {
    loadAndApplyStats();
  }

  // Newsletter footer — wire up every newsletter button on the page
  document.querySelectorAll('.newsletter').forEach(block => {
    const input = block.querySelector('input[type="email"]');
    const btn   = block.querySelector('button');
    if (!input || !btn) return;

    // Make sure button click never triggers a form submit
    btn.type = 'button';

    const origHTML = btn.innerHTML;

    const doSubscribe = async () => {
      const email = input.value.trim();
      if (!email || !email.includes('@')) {
        input.focus();
        input.style.outline = '2px solid #ef4444';
        setTimeout(() => { input.style.outline = ''; }, 1500);
        return;
      }

      // Instant visual feedback — show spinner right away
      btn.disabled = true;
      btn.innerHTML = '<i class="ph-fill ph-circle-notch"></i>';

      try {
        const result = await subscribeNewsletter(email);
        input.value = '';
        btn.innerHTML = '<i class="ph-fill ph-check"></i>';
        btn.style.background = '#10b981';
        btn.style.borderColor = '#10b981';
        const msg = result === 'already' ? 'Already subscribed!' : 'Subscribed! 🎉';
        const tip = document.createElement('small');
        tip.textContent = msg;
        tip.style.cssText = 'display:block;color:#10b981;font-size:.78rem;margin-top:6px';
        block.appendChild(tip);
        setTimeout(() => {
          btn.innerHTML = origHTML;
          btn.style.background = '';
          btn.style.borderColor = '';
          btn.disabled = false;
          tip.remove();
        }, 3500);
      } catch(e) {
        console.warn('Newsletter subscribe failed:', e.message);
        btn.innerHTML = origHTML;
        btn.style.background = '';
        btn.disabled = false;
        const tip = document.createElement('small');
        tip.textContent = 'Could not save — please try again shortly.';
        tip.style.cssText = 'display:block;color:#ef4444;font-size:.78rem;margin-top:6px';
        block.appendChild(tip);
        setTimeout(() => tip.remove(), 3500);
      }
    };

    btn.addEventListener('click', doSubscribe);
    input.addEventListener('keypress', e => { if (e.key === 'Enter') doSubscribe(); });
  });

  // Chat page
  initChat();

  // Admin page
  initAdmin();
});
