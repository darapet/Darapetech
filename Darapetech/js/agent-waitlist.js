/* =====================================================================
   DARAPET TECHNOLOGY — AGENT WAITLIST (Admin Panel)
   Appended to firebase-app.js scope via separate script tag
   OR inlined. This file holds renderAdminAgentWaitlist().
   ===================================================================== */

async function renderAdminAgentWaitlist(el) {
  el.innerHTML = `
  <style>
    .waitlist-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}
    .wl-card{background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;transition:border-color .15s}
    .wl-card:hover{border-color:var(--border-hover)}
    .wl-photo{width:52px;height:52px;border-radius:12px;object-fit:cover;border:2px solid var(--border-hover);flex-shrink:0}
    .wl-photo-ph{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1rem;font-weight:700;flex-shrink:0}
    .wl-badge{display:inline-block;background:rgba(245,158,11,0.12);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);border-radius:100px;padding:2px 10px;font-size:.7rem;font-weight:700}
    .wl-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
    .wl-btn{font-size:.75rem;padding:5px 12px;border-radius:6px;border:1px solid var(--border);background:transparent;cursor:pointer;font-family:inherit;color:var(--text-secondary);transition:all .15s;display:inline-flex;align-items:center;gap:5px}
    .wl-btn.approve{color:#10b981;border-color:rgba(16,185,129,0.4)}
    .wl-btn.approve:hover{background:rgba(16,185,129,0.1)}
    .wl-btn.reject{color:#ef4444;border-color:rgba(239,68,68,0.35)}
    .wl-btn.reject:hover{background:rgba(239,68,68,0.1)}
    .wl-btn.view{color:#3b82f6;border-color:rgba(59,130,246,0.35)}
    .wl-btn.view:hover{background:rgba(59,130,246,0.08)}
    .approve-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}
    .approve-modal{background:#fff;border-radius:16px;padding:28px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,.3)}
    .approve-modal h3{font-size:1.1rem;font-weight:700;margin-bottom:6px}
    .approve-modal p{font-size:.85rem;color:#64748b;margin-bottom:18px}
    .am-field{margin-bottom:14px}
    .am-field label{display:block;font-size:.8rem;font-weight:600;color:#374151;margin-bottom:5px}
    .am-field input{width:100%;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.88rem;font-family:inherit;color:#0f172a;outline:none;transition:border .2s}
    .am-field input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.12)}
    .am-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px}
    .am-btn-cancel{padding:10px 18px;background:#f1f5f9;color:#374151;border:1.5px solid #e2e8f0;border-radius:10px;font-size:.86rem;font-weight:600;cursor:pointer;font-family:inherit}
    .am-btn-approve{padding:10px 20px;background:#10b981;color:#fff;border:none;border-radius:10px;font-size:.86rem;font-weight:600;cursor:pointer;font-family:inherit;transition:background .2s}
    .am-btn-approve:hover{background:#059669}
    .am-btn-approve:disabled{opacity:.6;cursor:not-allowed}
    .am-err{color:#ef4444;font-size:.8rem;margin-top:10px;display:none}
    .profile-view-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;display:flex;align-items:center;justify-content:center;padding:16px}
    .profile-view-box{background:#fff;border-radius:16px;padding:28px;width:100%;max-width:500px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)}
    .pv-row{display:flex;gap:8px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #f1f5f9}
    .pv-label{font-size:.76rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;width:120px;flex-shrink:0;padding-top:2px}
    .pv-value{font-size:.88rem;color:#0f172a;flex:1}
  </style>

  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;flex-wrap:wrap;gap:12px">
    <div>
      <h2 style="margin:0 0 4px">Agent Waitlist</h2>
      <p style="color:var(--text-muted);font-size:.88rem;margin:0">Review and approve agent applications submitted through the registration form.</p>
    </div>
    <button class="btn btn-outline" style="font-size:.83rem" onclick="loadWaitlist()">
      <i class="ph-fill ph-arrow-clockwise"></i> Refresh
    </button>
  </div>

  <div id="waitlistGrid" class="waitlist-grid">
    <div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--text-muted)">
      <div style="width:26px;height:26px;border:3px solid #bfdbfe;border-top-color:#1d4ed8;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 12px"></div>
      Loading waitlist…
    </div>
  </div>`;

  window.loadWaitlist = async function() {
    const grid = document.getElementById('waitlistGrid');
    if (!grid) return;
    try {
      const snap = await db.collection('agent_applications').where('status','==','pending').orderBy('submittedAt','desc').get();
      const badge = document.getElementById('waitlistBadge');
      if (snap.empty) {
        grid.innerHTML = '<div style="grid-column:1/-1;padding:40px;text-align:center;color:var(--text-muted);font-size:.88rem">No pending applications. When agents self-register via the agent registration page, they\'ll appear here.</div>';
        if (badge) badge.style.display = 'none';
        return;
      }
      if (badge) { badge.textContent = snap.size; badge.style.display = 'inline'; }

      grid.innerHTML = snap.docs.map(doc => {
        const a = doc.data();
        const ts = a.submittedAt?.toDate ? a.submittedAt.toDate().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : '—';
        const photoEl = a.photoUrl
          ? `<img src="${escapeHtml(a.photoUrl)}" class="wl-photo" />`
          : `<div class="wl-photo-ph">${escapeHtml((a.firstName||'?').charAt(0).toUpperCase())}</div>`;
        return `<div class="wl-card" id="wlc-${doc.id}">
          <div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:10px">
            ${photoEl}
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:.92rem;color:var(--text-primary);margin-bottom:2px">${escapeHtml(a.fullName||'—')}</div>
              <div style="font-size:.76rem;color:var(--text-muted);font-weight:600">${escapeHtml(a.displayName||'')}</div>
              <span class="wl-badge" style="margin-top:4px">Pending Approval</span>
            </div>
          </div>
          <div style="font-size:.76rem;color:var(--text-muted);margin-bottom:3px"><i class="ph-fill ph-envelope" style="margin-right:4px"></i>${escapeHtml(a.email||'—')}</div>
          <div style="font-size:.76rem;color:var(--text-muted);margin-bottom:3px"><i class="ph-fill ph-device-mobile" style="margin-right:4px"></i>${escapeHtml(a.phone||'—')}</div>
          <div style="font-size:.76rem;color:var(--text-secondary);margin-bottom:3px"><i class="ph-fill ph-briefcase" style="margin-right:4px"></i>${escapeHtml(a.service||'—')}</div>
          <div style="font-size:.74rem;color:#3b82f6;margin-bottom:3px;font-weight:500">${escapeHtml(a.niche||'')}</div>
          <div style="font-size:.72rem;color:var(--text-muted)">Applied: ${ts}</div>
          <div style="font-size:.7rem;color:var(--text-muted);margin-top:2px">App ID: ${escapeHtml(a.appId||doc.id)}</div>
          <div class="wl-actions">
            <button class="wl-btn approve" onclick="showApproveModal('${doc.id}')"><i class="ph-fill ph-check-circle"></i> Approve</button>
            <button class="wl-btn reject" onclick="rejectApplication('${doc.id}')"><i class="ph-fill ph-x-circle"></i> Reject</button>
            <button class="wl-btn view" onclick="viewApplicantProfile('${doc.id}')"><i class="ph-fill ph-user"></i> View</button>
          </div>
        </div>`;
      }).join('');
    } catch(e) {
      grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;text-align:center;color:#ef4444;font-size:.85rem">Error: ${escapeHtml(e.message)}</div>`;
    }
  };
  window.loadWaitlist();

  window.showApproveModal = function(docId) {
    const existing = document.getElementById('approveModalOverlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'approve-modal-overlay';
    overlay.id = 'approveModalOverlay';
    overlay.innerHTML = `
      <div class="approve-modal">
        <h3>Approve Agent</h3>
        <p>Set a temporary password. The agent will be prompted to change it on first login.</p>
        <div class="am-field"><label>Temporary Password *</label><input type="password" id="amTempPw" placeholder="Min 8 characters" /></div>
        <div class="am-field"><label>Confirm Password *</label><input type="password" id="amConfirmPw" placeholder="Repeat password" /></div>
        <div class="am-err" id="amErr"></div>
        <div class="am-actions">
          <button class="am-btn-cancel" id="amCancelBtn">Cancel</button>
          <button class="am-btn-approve" id="amApproveBtn"><i class="ph-fill ph-check"></i> Approve &amp; Create Account</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('amCancelBtn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('amApproveBtn').addEventListener('click', () => doApproveAgent(docId, overlay));
  };

  async function doApproveAgent(docId, overlay) {
    const pw      = document.getElementById('amTempPw').value;
    const confirm = document.getElementById('amConfirmPw').value;
    const errEl   = document.getElementById('amErr');
    const btn     = document.getElementById('amApproveBtn');
    errEl.style.display = 'none';
    if (pw.length < 8) { errEl.textContent='Password must be at least 8 characters.'; errEl.style.display=''; return; }
    if (pw !== confirm) { errEl.textContent='Passwords do not match.'; errEl.style.display=''; return; }
    btn.disabled = true; btn.innerHTML = '<i class="ph-fill ph-spinner"></i> Creating…';
    try {
      const appDoc = await db.collection('agent_applications').doc(docId).get();
      if (!appDoc.exists) throw new Error('Application not found.');
      const a = appDoc.data();
      // Use secondary Firebase app so admin stays signed in
      let creatorApp;
      try { creatorApp = firebase.app('agentCreator'); } catch(e) {
        creatorApp = firebase.initializeApp(firebaseConfig, 'agentCreator');
      }
      const creatorAuth = creatorApp.auth();
      const cred = await creatorAuth.createUserWithEmailAndPassword(a.email, pw);
      const uid  = cred.user.uid;
      await creatorAuth.signOut();
      // Create agent doc in Firestore
      const agentId = await generateAgentId();
      await db.collection('agents').add({
        agentId, uid,
        name:        a.fullName || `${a.firstName||''} ${a.lastName||''}`.trim(),
        displayName: a.displayName || '',
        email:       a.email,
        phone:       a.phone || '',
        service:     a.service,
        niche:       a.niche || '',
        photoUrl:    a.photoUrl || '',
        bio: '', serviceDesc: '', country: '',
        skills: [], languages: [], portfolio: [], education: [],
        status: 'active', active: true, firstLogin: true,
        sourceAppId: a.appId || docId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      // Mark as approved
      await db.collection('agent_applications').doc(docId).update({
        status: 'approved',
        approvedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      overlay.remove();
      const card = document.getElementById('wlc-' + docId);
      if (card) card.remove();
      // Toast notification
      const toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#10b981;color:#fff;padding:12px 20px;border-radius:10px;font-size:.86rem;font-weight:600;z-index:300;box-shadow:0 8px 24px rgba(0,0,0,.2)';
      toast.textContent = `✓ ${a.fullName || a.email} approved — account created!`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
      window.loadWaitlist();
    } catch(e) {
      errEl.textContent = e.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists. Delete the old account first, then retry.'
        : e.message;
      errEl.style.display = '';
      btn.disabled = false; btn.innerHTML = '<i class="ph-fill ph-check"></i> Approve & Create Account';
    }
  }

  window.rejectApplication = async function(docId) {
    if (!confirm('Reject this application? The applicant will not be notified automatically.')) return;
    try {
      await db.collection('agent_applications').doc(docId).update({
        status: 'rejected',
        rejectedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      const card = document.getElementById('wlc-' + docId);
      if (card) { card.style.opacity='0.4'; card.style.pointerEvents='none'; }
      setTimeout(() => { window.loadWaitlist(); }, 400);
    } catch(e) { alert('Failed to reject: ' + e.message); }
  };

  window.viewApplicantProfile = async function(docId) {
    const existing = document.getElementById('profileViewOverlay');
    if (existing) existing.remove();
    let a, ts = '—';
    try {
      const doc = await db.collection('agent_applications').doc(docId).get();
      if (!doc.exists) { alert('Application not found.'); return; }
      a = doc.data();
      ts = a.submittedAt?.toDate ? a.submittedAt.toDate().toLocaleString() : '—';
    } catch(e) { alert('Error loading: ' + e.message); return; }
    const photoEl = a.photoUrl
      ? `<img src="${escapeHtml(a.photoUrl)}" style="width:80px;height:80px;border-radius:14px;object-fit:cover;border:2px solid #bfdbfe;margin-bottom:16px" />`
      : `<div style="width:80px;height:80px;border-radius:14px;background:linear-gradient(135deg,#1d4ed8,#3b82f6);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.8rem;font-weight:700;margin-bottom:16px">${escapeHtml((a.firstName||'?').charAt(0).toUpperCase())}</div>`;
    const overlay = document.createElement('div');
    overlay.className = 'profile-view-overlay'; overlay.id = 'profileViewOverlay';
    overlay.innerHTML = `
      <div class="profile-view-box">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <h3 style="font-size:1.1rem;font-weight:700">Applicant Profile</h3>
          <button onclick="document.getElementById('profileViewOverlay').remove()" style="width:28px;height:28px;border-radius:8px;background:#f1f5f9;border:none;cursor:pointer;color:#64748b;font-size:.85rem;display:flex;align-items:center;justify-content:center">✕</button>
        </div>
        ${photoEl}
        <div class="pv-row"><div class="pv-label">Full Name</div><div class="pv-value">${escapeHtml(a.fullName||'—')}</div></div>
        <div class="pv-row"><div class="pv-label">Display Name</div><div class="pv-value">${escapeHtml(a.displayName||'—')}</div></div>
        <div class="pv-row"><div class="pv-label">Email</div><div class="pv-value">${escapeHtml(a.email||'—')}</div></div>
        <div class="pv-row"><div class="pv-label">Phone</div><div class="pv-value">${escapeHtml(a.phone||'—')}</div></div>
        <div class="pv-row"><div class="pv-label">Service</div><div class="pv-value">${escapeHtml(a.service||'—')}</div></div>
        <div class="pv-row"><div class="pv-label">Niche</div><div class="pv-value">${escapeHtml(a.niche||'—')}</div></div>
        <div class="pv-row"><div class="pv-label">App ID</div><div class="pv-value" style="font-family:monospace;font-size:.82rem">${escapeHtml(a.appId||docId)}</div></div>
        <div class="pv-row"><div class="pv-label">Status</div><div class="pv-value"><span style="font-weight:700;color:#f59e0b">${escapeHtml(a.status||'pending')}</span></div></div>
        <div class="pv-row" style="border:none;margin-bottom:0"><div class="pv-label">Applied</div><div class="pv-value">${escapeHtml(ts)}</div></div>
        <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap">
          <button class="wl-btn approve" onclick="document.getElementById('profileViewOverlay').remove();showApproveModal('${docId}')"><i class="ph-fill ph-check-circle"></i> Approve</button>
          <button class="wl-btn reject" onclick="document.getElementById('profileViewOverlay').remove();rejectApplication('${docId}')"><i class="ph-fill ph-x-circle"></i> Reject</button>
          <button class="wl-btn" onclick="document.getElementById('profileViewOverlay').remove()">Close</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  };
}
