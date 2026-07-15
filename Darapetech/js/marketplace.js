/* ================================================================
   MARKETPLACE — seller registration + profile setup (Batch 1)
   Depends on: firebase-app.js (db, auth, TS) + marketplace-data.js
   ================================================================ */

/* ---------- Cloudinary ---------- */
let _mpCloudinaryCfg = null;
async function mpGetCloudinaryConfig() {
  if (_mpCloudinaryCfg) return _mpCloudinaryCfg;
  const doc = await db.collection('settings').doc('cloudinary').get();
  if (!doc.exists) throw new Error('Image uploads are not configured yet. Ask the site admin to set up Cloudinary in the admin dashboard.');
  const data = doc.data();
  if (!data.cloudName || !data.uploadPreset) throw new Error('Cloudinary is not fully configured yet.');
  _mpCloudinaryCfg = data;
  return data;
}

// Resize/compress an image client-side before upload so we don't burn
// through Cloudinary's free storage/bandwidth on huge phone camera photos.
function mpResizeImage(file, maxDim = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = e => { img.src = e.target.result; };
    reader.onerror = () => reject(new Error('Could not read file'));
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
        else { width = Math.round(width * (maxDim / height)); height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Image compression failed'));
        resolve(blob);
      }, 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error('Invalid image file'));
    reader.readAsDataURL(file);
  });
}

async function mpUploadImage(file, folder = 'darapet') {
  const cfg = await mpGetCloudinaryConfig();
  const blob = await mpResizeImage(file);
  const formData = new FormData();
  formData.append('file', blob, 'upload.jpg');
  formData.append('upload_preset', cfg.uploadPreset);
  formData.append('folder', folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`, { method: 'POST', body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Image upload failed');
  return data.secure_url;
}

/* ---------- Seller page bootstrap ---------- */
function initSellerPage() {
  const app = document.getElementById('sellerApp');
  if (!app) return;

  app.innerHTML = '<div style="text-align:center;padding:80px 20px"><i class="ph-fill ph-circle-notch spin" style="font-size:2rem;color:var(--accent-1)"></i></div>';

  auth.onAuthStateChanged(async user => {
    if (!user) { mpRenderSellerAuth(app); return; }
    try {
      const doc = await db.collection('sellers').doc(user.uid).get();
      if (!doc.exists) {
        // Google sign-in with no seller doc yet (first time) — create a shell record.
        await db.collection('sellers').doc(user.uid).set({
          firstName: user.displayName ? user.displayName.split(' ')[0] : '',
          lastName: user.displayName ? user.displayName.split(' ').slice(1).join(' ') : '',
          email: user.email,
          onboardingStep: 'profile',
          createdAt: TS(),
        });
      }
      const seller = (await db.collection('sellers').doc(user.uid).get()).data();
      mpRouteSeller(app, user, seller);
    } catch (e) {
      app.innerHTML = `<p style="color:#ef4444;text-align:center;padding:60px 20px">Something went wrong loading your seller account: ${e.message}</p>`;
    }
  });
}

function mpRouteSeller(app, user, seller) {
  if (seller.onboardingStep === 'profile') {
    mpRenderSellerProfileSetup(app, user, seller);
  } else {
    mpRenderSellerDashboard(app, user, seller);
  }
}

function mpRenderSellerAuth(app) {
  app.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:center;padding:60px 20px">
    <div class="glass-card" style="padding:36px;max-width:420px;width:100%">
      <h3 style="margin-bottom:4px" id="mpAuthTitle">Become a Seller</h3>
      <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:20px">Create your seller account to start listing gigs.</p>

      <button class="btn btn-outline" style="width:100%;margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:8px" id="mpGoogleBtn">
        <i class="ph-fill ph-google-logo"></i> Continue with Google
      </button>
      <div style="display:flex;align-items:center;gap:10px;margin:16px 0;color:var(--text-muted);font-size:.78rem">
        <div style="flex:1;height:1px;background:var(--border)"></div>or<div style="flex:1;height:1px;background:var(--border)"></div>
      </div>

      <div id="mpNameFields" style="display:flex;gap:10px">
        <div class="form-group" style="flex:1"><label>First name</label><input type="text" id="mpFirstName" /></div>
        <div class="form-group" style="flex:1"><label>Last name</label><input type="text" id="mpLastName" /></div>
      </div>
      <div class="form-group"><label>Email</label><input type="email" id="mpEmail" /></div>
      <div class="form-group"><label>Password</label><input type="password" id="mpPassword" /></div>
      <div id="mpAuthErr" style="color:#ef4444;font-size:.82rem;margin-bottom:12px;display:none"></div>
      <div id="mpAuthOk" style="color:#10b981;font-size:.82rem;margin-bottom:12px;display:none">Account created! Signing you in…</div>
      <button class="btn btn-primary" style="width:100%" id="mpAuthSubmit">Create Seller Account</button>
      <p style="font-size:.82rem;color:var(--text-muted);text-align:center;margin-top:14px">
        Already have an account? <a href="#" id="mpToggleLogin">Sign in</a>
      </p>
    </div>
  </div>`;

  let isLogin = false;
  const errEl = document.getElementById('mpAuthErr');
  const okEl  = document.getElementById('mpAuthOk');

  document.getElementById('mpToggleLogin').addEventListener('click', e => {
    e.preventDefault();
    isLogin = !isLogin;
    document.getElementById('mpNameFields').style.display = isLogin ? 'none' : 'flex';
    document.getElementById('mpAuthSubmit').textContent = isLogin ? 'Sign In' : 'Create Seller Account';
    document.getElementById('mpAuthTitle').textContent = isLogin ? 'Seller Sign In' : 'Become a Seller';
    e.target.textContent = isLogin ? 'Create one' : 'Sign in';
    e.target.previousSibling ? null : null;
    e.target.parentElement.firstChild.textContent = isLogin ? "Don't have an account? " : 'Already have an account? ';
  });

  document.getElementById('mpGoogleBtn').addEventListener('click', async () => {
    errEl.style.display = 'none';
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } catch (e) {
      errEl.textContent = e.message; errEl.style.display = '';
    }
  });

  document.getElementById('mpAuthSubmit').addEventListener('click', async () => {
    errEl.style.display = 'none'; okEl.style.display = 'none';
    const email = document.getElementById('mpEmail').value.trim();
    const password = document.getElementById('mpPassword').value;
    if (!email || !password) { errEl.textContent = 'Please fill all fields'; errEl.style.display = ''; return; }

    const btn = document.getElementById('mpAuthSubmit');
    btn.disabled = true;
    try {
      if (isLogin) {
        await auth.signInWithEmailAndPassword(email, password);
      } else {
        const firstName = document.getElementById('mpFirstName').value.trim();
        const lastName  = document.getElementById('mpLastName').value.trim();
        if (!firstName || !lastName) { throw new Error('Please enter your first and last name'); }
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: `${firstName} ${lastName}` });
        await db.collection('sellers').doc(cred.user.uid).set({
          firstName, lastName, email, onboardingStep: 'profile', createdAt: TS(),
        });
        okEl.style.display = '';
      }
    } catch (e) {
      errEl.textContent = e.message; errEl.style.display = '';
      btn.disabled = false;
    }
  });
}

function mpRenderSellerProfileSetup(app, user, seller) {
  const selectedServices = new Set(seller.services || []);
  const selectedSubs = new Set(seller.subServices || []);

  app.innerHTML = `
  <div style="max-width:640px;margin:0 auto;padding:40px 20px">
    <div style="margin-bottom:28px">
      <span style="font-size:.75rem;color:var(--accent-1);font-weight:700;text-transform:uppercase;letter-spacing:.06em">Step 1 of 3</span>
      <h2 style="margin:6px 0 4px">Set up your seller profile</h2>
      <p style="color:var(--text-muted);font-size:.9rem">This is what buyers will see about you. You can update it anytime.</p>
    </div>

    <div class="glass-card" style="padding:28px">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
        <img id="mpAvatarPreview" src="${seller.avatarUrl || '../assets/images/logo.png'}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:1px solid var(--border)" />
        <div>
          <input type="file" id="mpAvatarInput" accept="image/*" style="display:none" />
          <button class="btn btn-outline" id="mpAvatarBtn" type="button" style="font-size:.82rem">Upload profile picture</button>
          <div id="mpAvatarErr" style="color:#ef4444;font-size:.78rem;margin-top:6px;display:none"></div>
        </div>
      </div>

      <div class="form-group">
        <label>Display / business name</label>
        <input type="text" id="mpBusinessName" value="${seller.businessName || ''}" placeholder="e.g. Darapet Web Studio" />
      </div>

      <div class="form-group">
        <label>Country</label>
        <select id="mpCountry">
          <option value="">Select your country</option>
          ${MP_COUNTRIES.map(c => `<option value="${c}" ${seller.country === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>About you</label>
        <textarea id="mpBio" placeholder="Tell buyers a bit about your experience...">${seller.bio || ''}</textarea>
      </div>

      <div class="form-group">
        <label>Services you offer</label>
        <div id="mpServicesList" style="display:flex;flex-direction:column;gap:10px">
          ${MP_SERVICES.map(svc => `
            <div class="mp-service-block" data-service="${svc.id}">
              <label style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:.9rem;cursor:pointer">
                <input type="checkbox" class="mp-service-check" data-service="${svc.id}" ${selectedServices.has(svc.id) ? 'checked' : ''} />
                ${svc.label}
              </label>
              <div class="mp-subs-list" data-service="${svc.id}" style="display:${selectedServices.has(svc.id) ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 0 26px">
                ${svc.subs.map(sub => `
                  <label style="display:flex;align-items:center;gap:6px;font-size:.82rem;color:var(--text-secondary);cursor:pointer">
                    <input type="checkbox" class="mp-sub-check" data-service="${svc.id}" data-sub="${sub.id}" ${selectedSubs.has(sub.id) ? 'checked' : ''} />
                    ${sub.label}
                  </label>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div id="mpProfileErr" style="color:#ef4444;font-size:.82rem;margin-bottom:12px;display:none"></div>
      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button class="btn btn-primary" id="mpProfileSave">Save & Continue</button>
      </div>
    </div>
  </div>`;

  // Toggle sub-service lists when a top-level service is (un)checked
  document.querySelectorAll('.mp-service-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const list = document.querySelector(`.mp-subs-list[data-service="${cb.dataset.service}"]`);
      list.style.display = cb.checked ? 'grid' : 'none';
      if (!cb.checked) {
        list.querySelectorAll('.mp-sub-check').forEach(sub => { sub.checked = false; });
      }
    });
  });

  // Avatar upload
  let pendingAvatarUrl = seller.avatarUrl || null;
  document.getElementById('mpAvatarBtn').addEventListener('click', () => document.getElementById('mpAvatarInput').click());
  document.getElementById('mpAvatarInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const errEl = document.getElementById('mpAvatarErr');
    errEl.style.display = 'none';
    const btn = document.getElementById('mpAvatarBtn');
    const orig = btn.textContent;
    btn.textContent = 'Uploading…'; btn.disabled = true;
    try {
      pendingAvatarUrl = await mpUploadImage(file, `darapet/sellers/${user.uid}`);
      document.getElementById('mpAvatarPreview').src = pendingAvatarUrl;
    } catch (err) {
      errEl.textContent = err.message; errEl.style.display = '';
    }
    btn.textContent = orig; btn.disabled = false;
  });

  // Save & continue
  document.getElementById('mpProfileSave').addEventListener('click', async () => {
    const errEl = document.getElementById('mpProfileErr');
    errEl.style.display = 'none';

    const businessName = document.getElementById('mpBusinessName').value.trim();
    const country = document.getElementById('mpCountry').value;
    const bio = document.getElementById('mpBio').value.trim();
    const services = [...document.querySelectorAll('.mp-service-check:checked')].map(cb => cb.dataset.service);
    const subServices = [...document.querySelectorAll('.mp-sub-check:checked')].map(cb => cb.dataset.sub);

    if (!businessName) { errEl.textContent = 'Please enter a display/business name'; errEl.style.display = ''; return; }
    if (!country) { errEl.textContent = 'Please select your country'; errEl.style.display = ''; return; }
    if (!services.length) { errEl.textContent = 'Please select at least one service you offer'; errEl.style.display = ''; return; }

    const btn = document.getElementById('mpProfileSave');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const updated = {
        businessName, country, bio, services, subServices,
        avatarUrl: pendingAvatarUrl || null,
        onboardingStep: 'gig',
        updatedAt: TS(),
      };
      await db.collection('sellers').doc(user.uid).set(updated, { merge: true });
      mpRenderSellerDashboard(app, user, { ...seller, ...updated });
    } catch (e) {
      errEl.textContent = e.message; errEl.style.display = '';
      btn.disabled = false; btn.textContent = 'Save & Continue';
    }
  });
}

/* ---------- Seller profile settings (edit anytime, post-onboarding) ---------- */
function mpRenderSellerSettings(app, user, seller) {
  const selectedServices = new Set(seller.services || []);
  const selectedSubs = new Set(seller.subServices || []);

  app.innerHTML = `
  <div style="max-width:640px;margin:0 auto;padding:40px 20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px">
      <button class="btn btn-outline" id="mpSettingsBack" style="font-size:.8rem"><i class="ph-fill ph-arrow-left"></i> Back</button>
      <div>
        <h2 style="margin:0">Profile Settings</h2>
        <p style="color:var(--text-muted);font-size:.85rem;margin:2px 0 0">Update what buyers see about you.</p>
      </div>
    </div>

    <div class="glass-card" style="padding:28px">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
        <img id="mpAvatarPreview" src="${seller.avatarUrl || '../assets/images/logo.png'}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:1px solid var(--border)" />
        <div>
          <input type="file" id="mpAvatarInput" accept="image/*" style="display:none" />
          <button class="btn btn-outline" id="mpAvatarBtn" type="button" style="font-size:.82rem">Change profile picture</button>
          <div id="mpAvatarErr" style="color:#ef4444;font-size:.78rem;margin-top:6px;display:none"></div>
        </div>
      </div>

      <div class="form-group">
        <label>Display / business name</label>
        <input type="text" id="mpBusinessName" value="${seller.businessName || ''}" placeholder="e.g. Darapet Web Studio" />
      </div>

      <div class="form-group">
        <label>Country</label>
        <select id="mpCountry">
          <option value="">Select your country</option>
          ${MP_COUNTRIES.map(c => `<option value="${c}" ${seller.country === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label>About you</label>
        <textarea id="mpBio" placeholder="Tell buyers a bit about your experience...">${seller.bio || ''}</textarea>
      </div>

      <div class="form-group">
        <label>Services you offer</label>
        <div id="mpServicesList" style="display:flex;flex-direction:column;gap:10px">
          ${MP_SERVICES.map(svc => `
            <div class="mp-service-block" data-service="${svc.id}">
              <label style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:.9rem;cursor:pointer">
                <input type="checkbox" class="mp-service-check" data-service="${svc.id}" ${selectedServices.has(svc.id) ? 'checked' : ''} />
                ${svc.label}
              </label>
              <div class="mp-subs-list" data-service="${svc.id}" style="display:${selectedServices.has(svc.id) ? 'grid' : 'none'};grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 0 26px">
                ${svc.subs.map(sub => `
                  <label style="display:flex;align-items:center;gap:6px;font-size:.82rem;color:var(--text-secondary);cursor:pointer">
                    <input type="checkbox" class="mp-sub-check" data-service="${svc.id}" data-sub="${sub.id}" ${selectedSubs.has(sub.id) ? 'checked' : ''} />
                    ${sub.label}
                  </label>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div id="mpProfileErr" style="color:#ef4444;font-size:.82rem;margin-bottom:12px;display:none"></div>
      <div id="mpProfileOk" style="color:#10b981;font-size:.82rem;margin-bottom:12px;display:none">Saved!</div>
      <div style="display:flex;justify-content:flex-end;gap:10px">
        <button class="btn btn-primary" id="mpProfileSave">Save Changes</button>
      </div>
    </div>
  </div>`;

  document.getElementById('mpSettingsBack').addEventListener('click', () => mpRenderSellerDashboard(app, user, seller));

  document.querySelectorAll('.mp-service-check').forEach(cb => {
    cb.addEventListener('change', () => {
      const list = document.querySelector(`.mp-subs-list[data-service="${cb.dataset.service}"]`);
      list.style.display = cb.checked ? 'grid' : 'none';
      if (!cb.checked) {
        list.querySelectorAll('.mp-sub-check').forEach(sub => { sub.checked = false; });
      }
    });
  });

  let pendingAvatarUrl = seller.avatarUrl || null;
  document.getElementById('mpAvatarBtn').addEventListener('click', () => document.getElementById('mpAvatarInput').click());
  document.getElementById('mpAvatarInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const errEl = document.getElementById('mpAvatarErr');
    errEl.style.display = 'none';
    const btn = document.getElementById('mpAvatarBtn');
    const orig = btn.textContent;
    btn.textContent = 'Uploading…'; btn.disabled = true;
    try {
      pendingAvatarUrl = await mpUploadImage(file, `darapet/sellers/${user.uid}`);
      document.getElementById('mpAvatarPreview').src = pendingAvatarUrl;
    } catch (err) {
      errEl.textContent = err.message; errEl.style.display = '';
    }
    btn.textContent = orig; btn.disabled = false;
  });

  document.getElementById('mpProfileSave').addEventListener('click', async () => {
    const errEl = document.getElementById('mpProfileErr');
    const okEl = document.getElementById('mpProfileOk');
    errEl.style.display = 'none'; okEl.style.display = 'none';

    const businessName = document.getElementById('mpBusinessName').value.trim();
    const country = document.getElementById('mpCountry').value;
    const bio = document.getElementById('mpBio').value.trim();
    const services = [...document.querySelectorAll('.mp-service-check:checked')].map(cb => cb.dataset.service);
    const subServices = [...document.querySelectorAll('.mp-sub-check:checked')].map(cb => cb.dataset.sub);

    if (!businessName) { errEl.textContent = 'Please enter a display/business name'; errEl.style.display = ''; return; }
    if (!country) { errEl.textContent = 'Please select your country'; errEl.style.display = ''; return; }
    if (!services.length) { errEl.textContent = 'Please select at least one service you offer'; errEl.style.display = ''; return; }

    const btn = document.getElementById('mpProfileSave');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const updated = {
        businessName, country, bio, services, subServices,
        avatarUrl: pendingAvatarUrl || null,
        updatedAt: TS(),
      };
      await db.collection('sellers').doc(user.uid).set(updated, { merge: true });
      okEl.style.display = '';
      Object.assign(seller, updated);
    } catch (e) {
      errEl.textContent = e.message; errEl.style.display = '';
    }
    btn.disabled = false; btn.textContent = 'Save Changes';
  });
}

/* ---------- Seller dashboard (gig list) ---------- */
async function mpRenderSellerDashboard(app, user, seller) {
  app.innerHTML = '<div style="text-align:center;padding:80px 20px"><i class="ph-fill ph-circle-notch spin" style="font-size:2rem;color:var(--accent-1)"></i></div>';

  let gigs = [];
  try {
    const snap = await db.collection('gigs').where('sellerId', '==', user.uid).get();
    gigs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    app.innerHTML = `<p style="color:#ef4444;text-align:center;padding:60px 20px">Could not load your gigs: ${e.message}</p>`;
    return;
  }

  app.innerHTML = `
  <div style="max-width:900px;margin:0 auto;padding:40px 20px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:28px;flex-wrap:wrap">
      <div>
        <h2 style="margin-bottom:4px">Welcome, ${seller.businessName || seller.firstName || 'Seller'}</h2>
        <p style="color:var(--text-muted);font-size:.9rem">Manage your gigs below.</p>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn btn-outline" href="inbox.html" style="font-size:.85rem"><i class="ph-fill ph-chat-circle-text"></i> Inbox</a>
        <button class="btn btn-outline" id="mpSettingsBtn" style="font-size:.85rem"><i class="ph-fill ph-gear"></i> Settings</button>
        <button class="btn btn-primary" id="mpNewGigBtn"><i class="ph-fill ph-plus"></i> Create New Gig</button>
      </div>
    </div>

    ${gigs.length === 0 ? `
      <div class="glass-card" style="padding:48px;text-align:center">
        <i class="ph-fill ph-briefcase" style="font-size:2.4rem;color:var(--accent-1);margin-bottom:12px"></i>
        <h3 style="margin-bottom:6px">You haven't created a gig yet</h3>
        <p style="color:var(--text-muted);font-size:.9rem">Create your first gig so buyers can find and hire you.</p>
      </div>` : `
      <div style="display:flex;flex-direction:column;gap:14px">
        ${gigs.map(g => `
          <div class="glass-card" style="padding:20px;display:flex;align-items:center;gap:16px" data-gig="${g.id}">
            <img src="${(g.images && g.images[0]) || '../assets/images/logo.png'}" style="width:64px;height:64px;border-radius:10px;object-fit:cover;flex-shrink:0" />
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px">
                <h4 style="margin:0">${g.title}</h4>
                <span style="font-size:.7rem;padding:2px 8px;border-radius:20px;background:${g.status === 'published' ? 'rgba(16,185,129,.15);color:#10b981' : 'rgba(245,158,11,.15);color:#f59e0b'}">${g.status}</span>
              </div>
              <p style="color:var(--text-muted);font-size:.82rem;margin-top:4px">${mpGetSub(g.service, g.subService)?.label || ''} · from ${g.pricingTiers?.[0]?.price ?? '—'}</p>
            </div>
            <button class="btn btn-outline mp-edit-gig" data-gig="${g.id}" style="font-size:.82rem">Edit</button>
          </div>`).join('')}
      </div>`}
  </div>`;

  document.getElementById('mpNewGigBtn').addEventListener('click', () => mpRenderGigWizard(app, user, seller, null));
  document.getElementById('mpSettingsBtn').addEventListener('click', () => mpRenderSellerSettings(app, user, seller));
  document.querySelectorAll('.mp-edit-gig').forEach(btn => {
    btn.addEventListener('click', () => {
      const gig = gigs.find(g => g.id === btn.dataset.gig);
      mpRenderGigWizard(app, user, seller, gig);
    });
  });
}

/* ---------- Gig creation / edit wizard ---------- */
function mpInjectWizardStyles() {
  if (document.getElementById('mpWizardStyles')) return;
  const style = document.createElement('style');
  style.id = 'mpWizardStyles';
  style.textContent = `
    .mp-wizard-topbar { position:sticky; top:0; z-index:20; background:var(--bg-primary,#0a1420); border-bottom:1px solid var(--border); }
    .mp-wizard-tabs { display:flex; gap:28px; padding:0 24px; overflow-x:auto; }
    .mp-wizard-tab { padding:16px 2px; font-size:.86rem; font-weight:600; color:var(--text-muted); cursor:pointer; white-space:nowrap; border-bottom:2px solid transparent; }
    .mp-wizard-tab.active { color:var(--accent-1); border-bottom-color:var(--accent-1); }
    .mp-wizard-tip { background:linear-gradient(135deg,rgba(37,99,235,.14),rgba(37,99,235,.05)); border:1px solid rgba(37,99,235,.25); border-radius:12px; padding:16px 18px; margin-bottom:22px; font-size:.85rem; color:var(--text-secondary); }
    .mp-price-table { width:100%; border-collapse:collapse; font-size:.86rem; }
    .mp-price-table th, .mp-price-table td { border:1px solid var(--border); padding:10px 12px; vertical-align:top; }
    .mp-price-table th { background:var(--bg-card); text-align:left; font-size:.8rem; }
    .mp-price-table input, .mp-price-table textarea { width:100%; background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:8px 10px; color:var(--text-primary); font-size:.85rem; font-family:inherit; }
    .mp-price-table textarea { min-height:60px; resize:vertical; }
    .mp-upload-box { width:140px; height:120px; border:1.5px dashed var(--border); border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; cursor:pointer; color:var(--text-muted); font-size:.76rem; text-align:center; padding:8px; }
    .mp-upload-box:hover { border-color:var(--accent-1); color:var(--accent-1); }
    .mp-req-card { border:1px solid var(--border); border-radius:10px; padding:14px; }
  `;
  document.head.appendChild(style);
}

function mpRenderGigWizard(app, user, seller, existingGig) {
  mpInjectWizardStyles();

  const gig = existingGig || {
    title: '', service: '', subService: '', tags: [],
    pricingTiers: [{ tier: 'basic', name: 'Basic', description: '', deliveryDays: 3, revisions: 1, price: '' }],
    description: '', faq: [], requirements: [], images: [],
  };
  let tags = [...(gig.tags || [])];
  let faq = gig.faq && gig.faq.length ? gig.faq.map(f => ({ ...f })) : [];
  let requirements = [...(gig.requirements || [])];
  let images = [...(gig.images || [])];
  let activeTab = 'overview';
  let tiersEnabled = { basic: true, standard: false, premium: false };
  const tierDefaults = { basic: 'Basic', standard: 'Standard', premium: 'Premium' };
  ['basic', 'standard', 'premium'].forEach(t => {
    const existing = gig.pricingTiers?.find(p => p.tier === t);
    if (existing) tiersEnabled[t] = true;
  });

  const renderServiceOptions = () => MP_SERVICES.map(svc => `<option value="${svc.id}" ${gig.service === svc.id ? 'selected' : ''}>${svc.label}</option>`).join('');
  const renderSubOptions = (serviceId) => {
    const svc = mpGetService(serviceId);
    if (!svc) return '<option value="">Select a category first</option>';
    return svc.subs.map(sub => `<option value="${sub.id}" ${gig.subService === sub.id ? 'selected' : ''}>${sub.label}</option>`).join('');
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'description', label: 'Description & FAQ' },
    { id: 'requirements', label: 'Requirements' },
    { id: 'gallery', label: 'Gallery' },
  ];

  const priceCol = (tier, label) => {
    const existing = gig.pricingTiers?.find(p => p.tier === tier);
    const required = tier === 'basic';
    return `
    <th>
      <div style="display:flex;align-items:center;gap:6px;font-weight:700">
        ${required ? '' : `<input type="checkbox" class="mp-tier-enable" data-tier="${tier}" ${tiersEnabled[tier] ? 'checked' : ''} />`}
        ${label}
      </div>
    </th>`;
  };
  const priceCell = (tier, field, inputHtml) => `<td class="mp-tier-cell" data-tier="${tier}" data-field="${field}" style="${tiersEnabled[tier] || tier === 'basic' ? '' : 'opacity:.4'}">${inputHtml}</td>`;

  app.innerHTML = `
  <div class="mp-wizard-topbar">
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 24px;gap:16px">
      <button class="btn btn-outline" id="mpBackToDash" style="font-size:.8rem"><i class="ph-fill ph-arrow-left"></i> Back to dashboard</button>
      <div style="display:flex;gap:10px">
        <button class="btn btn-outline" id="gigSaveBtn" style="font-size:.82rem">Save</button>
        <button class="btn btn-primary" id="gigPublishBtn" style="font-size:.82rem">${existingGig && existingGig.status === 'published' ? 'Save & Update' : 'Save & Publish'}</button>
      </div>
    </div>
    <div class="mp-wizard-tabs">
      ${tabs.map(t => `<div class="mp-wizard-tab${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}">${t.label}</div>`).join('')}
    </div>
  </div>

  <div style="max-width:820px;margin:0 auto;padding:32px 20px 60px">
    <div id="gigErr" style="color:#ef4444;font-size:.85rem;margin-bottom:16px;display:none"></div>

    <div class="mp-tab-panel" data-panel="overview">
      <div class="mp-wizard-tip"><strong>Start defining your Gig.</strong> Your title is the first thing buyers see — keep it clear and specific about what you deliver.</div>
      <div class="glass-card" style="padding:24px">
        <div class="form-group"><label>Gig title</label><input type="text" id="gigTitle" value="${gig.title || ''}" placeholder="e.g. I will build a modern, responsive business website" maxlength="80" /></div>
        <div style="display:flex;gap:12px">
          <div class="form-group" style="flex:1">
            <label>Category</label>
            <select id="gigService"><option value="">Select category</option>${renderServiceOptions()}</select>
          </div>
          <div class="form-group" style="flex:1">
            <label>Service type</label>
            <select id="gigSubService"><option value="">Select category first</option>${renderSubOptions(gig.service)}</select>
          </div>
        </div>
        <div class="form-group">
          <label>Search tags (press Enter to add, up to 5)</label>
          <input type="text" id="gigTagInput" placeholder="Type a tag and press Enter" />
          <div id="gigTagsWrap" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"></div>
        </div>
      </div>
    </div>

    <div class="mp-tab-panel" data-panel="pricing" style="display:none">
      <div class="mp-wizard-tip"><strong>Set the price for your packages.</strong> Buyers can compare Basic, Standard and Premium side by side — Standard and Premium are optional.</div>
      <div class="glass-card" style="padding:20px;overflow-x:auto">
        <table class="mp-price-table">
          <thead><tr><th></th>${priceCol('basic', 'Basic')}${priceCol('standard', 'Standard')}${priceCol('premium', 'Premium')}</tr></thead>
          <tbody>
            <tr><th>Package name</th>
              ${['basic','standard','premium'].map(t => priceCell(t, 'name', `<input type="text" class="mp-tier-name" data-tier="${t}" value="${gig.pricingTiers?.find(p=>p.tier===t)?.name || tierDefaults[t]}" />`)).join('')}
            </tr>
            <tr><th>Description</th>
              ${['basic','standard','premium'].map(t => priceCell(t, 'description', `<textarea class="mp-tier-desc" data-tier="${t}">${gig.pricingTiers?.find(p=>p.tier===t)?.description || ''}</textarea>`)).join('')}
            </tr>
            <tr><th>Delivery time (days)</th>
              ${['basic','standard','premium'].map(t => priceCell(t, 'deliveryDays', `<input type="number" min="1" class="mp-tier-days" data-tier="${t}" value="${gig.pricingTiers?.find(p=>p.tier===t)?.deliveryDays ?? 3}" />`)).join('')}
            </tr>
            <tr><th>Revisions</th>
              ${['basic','standard','premium'].map(t => priceCell(t, 'revisions', `<input type="number" min="0" class="mp-tier-revisions" data-tier="${t}" value="${gig.pricingTiers?.find(p=>p.tier===t)?.revisions ?? 1}" />`)).join('')}
            </tr>
            <tr><th>Price (USD)</th>
              ${['basic','standard','premium'].map(t => priceCell(t, 'price', `<input type="number" min="5" class="mp-tier-price" data-tier="${t}" value="${gig.pricingTiers?.find(p=>p.tier===t)?.price ?? ''}" />`)).join('')}
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="mp-tab-panel" data-panel="description" style="display:none">
      <div class="mp-wizard-tip"><strong>Write your Description &amp; FAQ.</strong> Explain the most important information for your Gig, and add answers to the most commonly asked questions.</div>
      <div class="glass-card" style="padding:24px;margin-bottom:20px">
        <h4 style="margin-bottom:12px">Description</h4>
        <div class="form-group"><textarea id="gigDescription" style="min-height:160px" placeholder="Briefly describe your Gig...">${gig.description || ''}</textarea></div>
      </div>
      <div class="glass-card" style="padding:24px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <h4 style="margin:0">Frequently Asked Questions</h4>
          <button class="btn btn-outline" id="gigAddFaq" type="button" style="font-size:.8rem">+ Add FAQ</button>
        </div>
        <p style="font-size:.82rem;color:var(--text-muted);margin:6px 0 14px">Add questions & answers for your buyers.</p>
        <div id="gigFaqList" style="display:flex;flex-direction:column;gap:10px"></div>
      </div>
    </div>

    <div class="mp-tab-panel" data-panel="requirements" style="display:none">
      <div class="mp-wizard-tip"><strong>Get all the information you need from buyers to get started.</strong> Add questions to help buyers provide you with exactly what you need to start working on their order.</div>
      <div class="glass-card" style="padding:24px">
        <div id="gigReqList" style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px"></div>
        <button class="btn btn-outline" id="gigAddReq" type="button" style="font-size:.82rem">+ Add New Question</button>
      </div>
    </div>

    <div class="mp-tab-panel" data-panel="gallery" style="display:none">
      <div class="mp-wizard-tip"><strong>Showcase your services in a Gig gallery.</strong> Encourage buyers to choose your Gig by featuring a variety of your work. Up to 3 images.</div>
      <div class="glass-card" style="padding:24px">
        <div id="gigImagesWrap" style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px"></div>
        <input type="file" id="gigImageInput" accept="image/*" style="display:none" />
        <div id="gigImageErr" style="color:#ef4444;font-size:.82rem;margin-top:8px;display:none"></div>
      </div>
    </div>
  </div>`;

  document.getElementById('mpBackToDash').addEventListener('click', () => mpRenderSellerDashboard(app, user, seller));

  // Tab switching
  document.querySelectorAll('.mp-wizard-tab').forEach(tabEl => {
    tabEl.addEventListener('click', () => {
      activeTab = tabEl.dataset.tab;
      document.querySelectorAll('.mp-wizard-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
      document.querySelectorAll('.mp-tab-panel').forEach(p => { p.style.display = p.dataset.panel === activeTab ? 'block' : 'none'; });
    });
  });

  document.getElementById('gigService').addEventListener('change', e => {
    document.getElementById('gigSubService').innerHTML = `<option value="">Select service type</option>${renderSubOptions(e.target.value)}`;
  });

  // Tags
  const renderTags = () => {
    document.getElementById('gigTagsWrap').innerHTML = tags.map((t, i) => `
      <span style="background:rgba(37,99,235,.12);color:var(--accent-1);padding:4px 10px;border-radius:20px;font-size:.78rem;display:inline-flex;align-items:center;gap:6px">
        ${t} <i class="ph-fill ph-x mp-tag-remove" data-idx="${i}" style="cursor:pointer"></i>
      </span>`).join('');
    document.querySelectorAll('.mp-tag-remove').forEach(icon => {
      icon.addEventListener('click', () => { tags.splice(+icon.dataset.idx, 1); renderTags(); });
    });
  };
  document.getElementById('gigTagInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val && tags.length < 5 && !tags.includes(val)) { tags.push(val); renderTags(); }
      e.target.value = '';
    }
  });
  renderTags();

  // Pricing tier enable/disable toggling
  document.querySelectorAll('.mp-tier-enable').forEach(cb => {
    cb.addEventListener('change', () => {
      document.querySelectorAll(`.mp-tier-cell[data-tier="${cb.dataset.tier}"]`).forEach(cell => { cell.style.opacity = cb.checked ? '1' : '.4'; });
    });
  });

  // FAQ
  const renderFaq = () => {
    document.getElementById('gigFaqList').innerHTML = faq.map((f, i) => `
      <div class="mp-req-card">
        <div class="form-group" style="margin-bottom:8px"><label>Question</label><input type="text" class="mp-faq-q" data-idx="${i}" value="${f.q || ''}" /></div>
        <div class="form-group" style="margin-bottom:6px"><label>Answer</label><textarea class="mp-faq-a" data-idx="${i}" style="min-height:60px">${f.a || ''}</textarea></div>
        <button type="button" class="mp-faq-remove" data-idx="${i}" style="background:none;border:none;color:#ef4444;font-size:.78rem;cursor:pointer">Remove</button>
      </div>`).join('') || '<p style="font-size:.82rem;color:var(--text-muted)">No FAQs added yet.</p>';
    document.querySelectorAll('.mp-faq-q').forEach(inp => inp.addEventListener('input', e => { faq[+e.target.dataset.idx].q = e.target.value; }));
    document.querySelectorAll('.mp-faq-a').forEach(inp => inp.addEventListener('input', e => { faq[+e.target.dataset.idx].a = e.target.value; }));
    document.querySelectorAll('.mp-faq-remove').forEach(btn => btn.addEventListener('click', () => { faq.splice(+btn.dataset.idx, 1); renderFaq(); }));
  };
  document.getElementById('gigAddFaq').addEventListener('click', () => { faq.push({ q: '', a: '' }); renderFaq(); });
  renderFaq();

  // Requirements
  const renderReq = () => {
    document.getElementById('gigReqList').innerHTML = requirements.map((r, i) => `
      <div class="mp-req-card" style="display:flex;gap:10px;align-items:flex-start">
        <textarea class="mp-req-input" data-idx="${i}" style="flex:1;min-height:44px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text-primary);font-family:inherit;font-size:.85rem" placeholder="e.g. What's your business name, industry, and goals?">${r}</textarea>
        <button type="button" class="mp-req-remove" data-idx="${i}" style="background:none;border:none;color:#ef4444;cursor:pointer"><i class="ph-fill ph-trash"></i></button>
      </div>`).join('') || '<p style="font-size:.82rem;color:var(--text-muted)">No requirements added yet.</p>';
    document.querySelectorAll('.mp-req-input').forEach(inp => inp.addEventListener('input', e => { requirements[+e.target.dataset.idx] = e.target.value; }));
    document.querySelectorAll('.mp-req-remove').forEach(btn => btn.addEventListener('click', () => { requirements.splice(+btn.dataset.idx, 1); renderReq(); }));
  };
  document.getElementById('gigAddReq').addEventListener('click', () => { requirements.push(''); renderReq(); });
  renderReq();

  // Gallery
  const renderImages = () => {
    const wrap = document.getElementById('gigImagesWrap');
    let html = images.map((url, i) => `
      <div style="position:relative">
        <img src="${url}" style="width:140px;height:120px;object-fit:cover;border-radius:10px" />
        <i class="ph-fill ph-x-circle mp-img-remove" data-idx="${i}" style="position:absolute;top:-6px;right:-6px;background:#0c1829;border-radius:50%;color:#ef4444;font-size:1.2rem;cursor:pointer"></i>
      </div>`).join('');
    if (images.length < 3) {
      html += `<div class="mp-upload-box" id="gigAddImageBtn"><i class="ph-fill ph-image" style="font-size:1.4rem"></i>Drag & drop a Photo or <span style="color:var(--accent-1)">Browse</span></div>`;
    }
    wrap.innerHTML = html;
    document.querySelectorAll('.mp-img-remove').forEach(icon => icon.addEventListener('click', () => { images.splice(+icon.dataset.idx, 1); renderImages(); }));
    const addBtn = document.getElementById('gigAddImageBtn');
    if (addBtn) addBtn.addEventListener('click', () => document.getElementById('gigImageInput').click());
  };
  document.getElementById('gigImageInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const errEl = document.getElementById('gigImageErr');
    errEl.style.display = 'none';
    try {
      const url = await mpUploadImage(file, `darapet/gigs/${user.uid}`);
      images.push(url);
      renderImages();
    } catch (err) {
      errEl.textContent = err.message; errEl.style.display = '';
    }
    e.target.value = '';
  });
  renderImages();

  // Collect + validate + save
  const collectPayload = () => {
    const errEl = document.getElementById('gigErr');
    errEl.style.display = 'none';

    const title = document.getElementById('gigTitle').value.trim();
    const service = document.getElementById('gigService').value;
    const subService = document.getElementById('gigSubService').value;
    const description = document.getElementById('gigDescription').value.trim();

    if (!title) { errEl.textContent = 'Please enter a gig title (Overview tab)'; errEl.style.display = ''; return null; }
    if (!service || !subService) { errEl.textContent = 'Please select a category and service type (Overview tab)'; errEl.style.display = ''; return null; }
    if (!description) { errEl.textContent = 'Please add a description (Description & FAQ tab)'; errEl.style.display = ''; return null; }

    const pricingTiers = [];
    for (const tier of ['basic', 'standard', 'premium']) {
      const cb = document.querySelector(`.mp-tier-enable[data-tier="${tier}"]`);
      const enabled = tier === 'basic' || (cb && cb.checked);
      if (!enabled) continue;
      const price = parseFloat(document.querySelector(`.mp-tier-price[data-tier="${tier}"]`).value);
      if (!price || price < 5) { errEl.textContent = `Please set a valid price (min $5) for the ${tier} package (Pricing tab)`; errEl.style.display = ''; return null; }
      pricingTiers.push({
        tier,
        name: document.querySelector(`.mp-tier-name[data-tier="${tier}"]`).value.trim() || tierDefaults[tier],
        description: document.querySelector(`.mp-tier-desc[data-tier="${tier}"]`).value.trim(),
        deliveryDays: parseInt(document.querySelector(`.mp-tier-days[data-tier="${tier}"]`).value, 10) || 1,
        revisions: parseInt(document.querySelector(`.mp-tier-revisions[data-tier="${tier}"]`).value, 10) || 0,
        price,
      });
    }
    if (!pricingTiers.length) { errEl.textContent = 'Please configure at least the Basic package (Pricing tab)'; errEl.style.display = ''; return null; }

    return {
      sellerId: user.uid,
      title, service, subService, tags,
      pricingTiers, description,
      faq: faq.filter(f => f.q.trim() && f.a.trim()),
      requirements: requirements.filter(r => r.trim()),
      images,
      updatedAt: TS(),
    };
  };

  const saveGig = async (status, btn, busyLabel, idleLabel) => {
    const payload = collectPayload();
    if (!payload) return;
    payload.status = status;
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = busyLabel;
    try {
      if (existingGig && existingGig.id) {
        await db.collection('gigs').doc(existingGig.id).update(payload);
      } else {
        payload.createdAt = TS();
        const ref = await db.collection('gigs').add(payload);
        existingGig = { id: ref.id, ...payload };
      }
      mpRenderSellerDashboard(app, user, seller);
    } catch (e) {
      document.getElementById('gigErr').textContent = e.message;
      document.getElementById('gigErr').style.display = '';
      btn.disabled = false; btn.textContent = idleLabel || orig;
    }
  };

  document.getElementById('gigSaveBtn').addEventListener('click', () => {
    const btn = document.getElementById('gigSaveBtn');
    saveGig('draft', btn, 'Saving…', 'Save');
  });
  document.getElementById('gigPublishBtn').addEventListener('click', () => {
    const btn = document.getElementById('gigPublishBtn');
    const idle = existingGig && existingGig.status === 'published' ? 'Save & Update' : 'Save & Publish';
    saveGig('published', btn, 'Saving…', idle);
  });
}

/* ================================================================
   MESSAGING — buyer <-> seller inbox & chat threads
   Firestore: mp_threads/{id} { participants:[uidA,uidB], participantInfo, gigId, gigTitle, lastMessage, lastMessageAt, lastSenderId }
              mp_threads/{id}/messages/{id} { senderId, text, createdAt }
   ================================================================ */
function mpThreadId(uidA, uidB, gigId) {
  return [uidA, uidB].sort().join('_') + (gigId ? '_' + gigId : '_general');
}

async function mpOpenThread(otherUid, otherName, otherAvatar, gig) {
  const user = auth.currentUser;
  if (!user) throw new Error('You must be signed in to send a message.');
  if (user.uid === otherUid) throw new Error("You can't message yourself.");

  const gigId = gig ? gig.id : null;
  const threadId = mpThreadId(user.uid, otherUid, gigId);
  const ref = db.collection('mp_threads').doc(threadId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      participants: [user.uid, otherUid],
      participantInfo: {
        [user.uid]: { name: user.displayName || user.email || 'User', avatarUrl: user.photoURL || null },
        [otherUid]: { name: otherName || 'User', avatarUrl: otherAvatar || null },
      },
      gigId: gigId,
      gigTitle: gig ? gig.title : null,
      lastMessage: null,
      lastMessageAt: TS(),
      lastSenderId: null,
      createdAt: TS(),
    });
  }
  return threadId;
}

let _mpThreadUnsub = null;
let _mpInboxUnsub = null;

function initInboxPage() {
  const app = document.getElementById('inboxApp');
  if (!app) return;

  app.innerHTML = '<div style="text-align:center;padding:80px 20px"><i class="ph-fill ph-circle-notch spin" style="font-size:2rem;color:var(--accent-1)"></i></div>';

  auth.onAuthStateChanged(user => {
    if (_mpInboxUnsub) { _mpInboxUnsub(); _mpInboxUnsub = null; }
    if (_mpThreadUnsub) { _mpThreadUnsub(); _mpThreadUnsub = null; }
    if (!user) { mpRenderInboxAuth(app); return; }

    const params = new URLSearchParams(location.search);
    const threadParam = params.get('thread');
    if (threadParam) {
      mpRenderThreadView(app, user, threadParam);
    } else {
      mpRenderInbox(app, user);
    }
  });
}

function mpRenderInboxAuth(app) {
  app.innerHTML = `
  <div style="display:flex;align-items:center;justify-content:center;padding:60px 20px">
    <div class="glass-card" style="padding:36px;max-width:400px;width:100%;text-align:center">
      <i class="ph-fill ph-chat-circle-text" style="font-size:2.2rem;color:var(--accent-1);margin-bottom:12px"></i>
      <h3 style="margin-bottom:6px">Sign in to view messages</h3>
      <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:20px">Your inbox is where you chat with buyers and sellers.</p>
      <button class="btn btn-primary" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px" id="mpInboxGoogleBtn">
        <i class="ph-fill ph-google-logo"></i> Continue with Google
      </button>
      <div id="mpInboxAuthErr" style="color:#ef4444;font-size:.82rem;margin-top:12px;display:none"></div>
    </div>
  </div>`;
  document.getElementById('mpInboxGoogleBtn').addEventListener('click', async () => {
    const errEl = document.getElementById('mpInboxAuthErr');
    errEl.style.display = 'none';
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      await auth.signInWithPopup(provider);
    } catch (e) {
      errEl.textContent = e.message; errEl.style.display = '';
    }
  });
}

function mpRenderInbox(app, user) {
  app.innerHTML = `
  <div style="max-width:760px;margin:0 auto;padding:40px 20px">
    <h2 style="margin-bottom:4px">Inbox</h2>
    <p style="color:var(--text-muted);font-size:.9rem;margin-bottom:24px">Your conversations with buyers and sellers.</p>
    <div id="mpThreadList" style="display:flex;flex-direction:column;gap:10px"></div>
  </div>`;

  const listEl = document.getElementById('mpThreadList');
  _mpInboxUnsub = db.collection('mp_threads')
    .where('participants', 'array-contains', user.uid)
    .orderBy('lastMessageAt', 'desc')
    .onSnapshot(snap => {
      const threads = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (!threads.length) {
        listEl.innerHTML = `
        <div class="glass-card" style="padding:48px;text-align:center">
          <i class="ph-fill ph-tray" style="font-size:2.2rem;color:var(--accent-1);margin-bottom:12px"></i>
          <h3 style="margin-bottom:6px">No conversations yet</h3>
          <p style="color:var(--text-muted);font-size:.9rem">Messages with buyers or sellers will show up here.</p>
        </div>`;
        return;
      }
      listEl.innerHTML = threads.map(t => {
        const otherUid = (t.participants || []).find(p => p !== user.uid);
        const info = (t.participantInfo && t.participantInfo[otherUid]) || {};
        return `
        <div class="glass-card mp-thread-row" data-thread="${t.id}" style="padding:16px 18px;display:flex;align-items:center;gap:14px;cursor:pointer">
          <img src="${info.avatarUrl || '../assets/images/logo.png'}" style="width:46px;height:46px;border-radius:50%;object-fit:cover;flex-shrink:0" />
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
              <h4 style="margin:0;font-size:.94rem">${info.name || 'User'}</h4>
            </div>
            ${t.gigTitle ? `<p style="margin:2px 0 0;font-size:.78rem;color:var(--accent-1)">${t.gigTitle}</p>` : ''}
            <p style="margin:4px 0 0;font-size:.85rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.lastMessage || 'No messages yet'}</p>
          </div>
        </div>`;
      }).join('');
      document.querySelectorAll('.mp-thread-row').forEach(row => {
        row.addEventListener('click', () => {
          history.pushState({}, '', `?thread=${row.dataset.thread}`);
          if (_mpInboxUnsub) { _mpInboxUnsub(); _mpInboxUnsub = null; }
          mpRenderThreadView(app, user, row.dataset.thread);
        });
      });
    }, err => {
      listEl.innerHTML = `<p style="color:#ef4444">Could not load your inbox: ${err.message}</p>`;
    });
}

async function mpRenderThreadView(app, user, threadId) {
  app.innerHTML = '<div style="text-align:center;padding:80px 20px"><i class="ph-fill ph-circle-notch spin" style="font-size:2rem;color:var(--accent-1)"></i></div>';

  let thread;
  try {
    const doc = await db.collection('mp_threads').doc(threadId).get();
    if (!doc.exists) throw new Error('Conversation not found.');
    thread = doc.data();
    if (!(thread.participants || []).includes(user.uid)) throw new Error("You don't have access to this conversation.");
  } catch (e) {
    app.innerHTML = `<p style="color:#ef4444;text-align:center;padding:60px 20px">${e.message}</p>`;
    return;
  }

  const otherUid = thread.participants.find(p => p !== user.uid);
  const otherInfo = (thread.participantInfo && thread.participantInfo[otherUid]) || {};

  app.innerHTML = `
  <div style="max-width:760px;margin:0 auto;padding:24px 20px;display:flex;flex-direction:column;height:calc(100vh - var(--strip-height) - var(--nav-height) - 48px)">
    <div style="display:flex;align-items:center;gap:12px;padding-bottom:16px;border-bottom:1px solid var(--border);margin-bottom:16px">
      <button class="btn btn-outline" id="mpThreadBack" style="font-size:.8rem"><i class="ph-fill ph-arrow-left"></i></button>
      <img src="${otherInfo.avatarUrl || '../assets/images/logo.png'}" style="width:38px;height:38px;border-radius:50%;object-fit:cover" />
      <div>
        <h4 style="margin:0;font-size:.92rem">${otherInfo.name || 'User'}</h4>
        ${thread.gigTitle ? `<p style="margin:1px 0 0;font-size:.76rem;color:var(--accent-1)">${thread.gigTitle}</p>` : ''}
      </div>
    </div>
    <div id="mpMessages" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:4px 2px"></div>
    <div style="display:flex;gap:10px;margin-top:14px">
      <input type="text" id="mpMsgInput" placeholder="Type a message…" style="flex:1;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px 14px;color:var(--text-primary);font-size:.9rem" />
      <button class="btn btn-primary" id="mpMsgSend"><i class="ph-fill ph-paper-plane-tilt"></i></button>
    </div>
    <div id="mpMsgErr" style="color:#ef4444;font-size:.8rem;margin-top:8px;display:none"></div>
  </div>`;

  document.getElementById('mpThreadBack').addEventListener('click', () => {
    if (_mpThreadUnsub) { _mpThreadUnsub(); _mpThreadUnsub = null; }
    history.pushState({}, '', location.pathname);
    mpRenderInbox(app, user);
  });

  const msgsEl = document.getElementById('mpMessages');
  _mpThreadUnsub = db.collection('mp_threads').doc(threadId).collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      msgsEl.innerHTML = snap.docs.map(d => {
        const m = d.data();
        const mine = m.senderId === user.uid;
        return `<div style="align-self:${mine ? 'flex-end' : 'flex-start'};max-width:70%;background:${mine ? 'var(--accent-1)' : 'var(--bg-card)'};color:${mine ? '#fff' : 'var(--text-primary)'};padding:10px 14px;border-radius:14px;font-size:.88rem;word-wrap:break-word">${m.text}</div>`;
      }).join('');
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }, err => {
      msgsEl.innerHTML = `<p style="color:#ef4444">Could not load messages: ${err.message}</p>`;
    });

  const send = async () => {
    const input = document.getElementById('mpMsgInput');
    const text = input.value.trim();
    if (!text) return;
    const errEl = document.getElementById('mpMsgErr');
    errEl.style.display = 'none';
    input.value = '';
    try {
      await db.collection('mp_threads').doc(threadId).collection('messages').add({
        senderId: user.uid, text, createdAt: TS(),
      });
      await db.collection('mp_threads').doc(threadId).update({
        lastMessage: text, lastMessageAt: TS(), lastSenderId: user.uid,
      });
    } catch (e) {
      errEl.textContent = e.message; errEl.style.display = '';
    }
  };
  document.getElementById('mpMsgSend').addEventListener('click', send);
  document.getElementById('mpMsgInput').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
}

/* ================================================================
   BUYER AUTH MODAL + ACCOUNT BAR — reusable across gigs.html / gig.html
   Buyers get a lightweight `users/{uid}` profile doc (name, avatar).
   ================================================================ */
function mpInjectModalStyles() {
  if (document.getElementById('mpModalStyles')) return;
  const style = document.createElement('style');
  style.id = 'mpModalStyles';
  style.textContent = `
    .mp-modal-overlay { position:fixed; inset:0; background:rgba(5,10,20,.7); z-index:200; display:flex; align-items:center; justify-content:center; padding:20px; }
    .mp-account-bar { display:flex; align-items:center; gap:10px; }
    .mp-account-avatar { width:34px; height:34px; border-radius:50%; object-fit:cover; }
  `;
  document.head.appendChild(style);
}

function mpShowAuthModal(subtitle) {
  mpInjectModalStyles();
  return new Promise((resolve, reject) => {
    const overlay = document.createElement('div');
    overlay.className = 'mp-modal-overlay';
    overlay.innerHTML = `
      <div class="glass-card" style="padding:32px;max-width:400px;width:100%;position:relative">
        <button id="mpModalClose" style="position:absolute;top:14px;right:14px;background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer">✕</button>
        <h3 style="margin-bottom:4px" id="mpModalTitle">Sign in to continue</h3>
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:20px">${subtitle || ''}</p>

        <button class="btn btn-outline" style="width:100%;margin-bottom:16px;display:flex;align-items:center;justify-content:center;gap:8px" id="mpModalGoogleBtn">
          <i class="ph-fill ph-google-logo"></i> Continue with Google
        </button>
        <div style="display:flex;align-items:center;gap:10px;margin:16px 0;color:var(--text-muted);font-size:.78rem">
          <div style="flex:1;height:1px;background:var(--border)"></div>or<div style="flex:1;height:1px;background:var(--border)"></div>
        </div>

        <div id="mpModalNameFields" style="display:flex;gap:10px">
          <div class="form-group" style="flex:1"><label>First name</label><input type="text" id="mpModalFirstName" /></div>
          <div class="form-group" style="flex:1"><label>Last name</label><input type="text" id="mpModalLastName" /></div>
        </div>
        <div class="form-group"><label>Email</label><input type="email" id="mpModalEmail" /></div>
        <div class="form-group"><label>Password</label><input type="password" id="mpModalPassword" /></div>
        <div id="mpModalErr" style="color:#ef4444;font-size:.82rem;margin-bottom:12px;display:none"></div>
        <button class="btn btn-primary" style="width:100%" id="mpModalSubmit">Create Account</button>
        <p style="font-size:.82rem;color:var(--text-muted);text-align:center;margin-top:14px">
          Already have an account? <a href="#" id="mpModalToggle">Sign in</a>
        </p>
      </div>`;
    document.body.appendChild(overlay);

    let isLogin = false;
    const close = () => overlay.remove();
    const errEl = overlay.querySelector('#mpModalErr');

    overlay.querySelector('#mpModalClose').addEventListener('click', () => { close(); reject(new Error('cancelled')); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { close(); reject(new Error('cancelled')); } });

    overlay.querySelector('#mpModalToggle').addEventListener('click', e => {
      e.preventDefault();
      isLogin = !isLogin;
      overlay.querySelector('#mpModalNameFields').style.display = isLogin ? 'none' : 'flex';
      overlay.querySelector('#mpModalSubmit').textContent = isLogin ? 'Sign In' : 'Create Account';
      overlay.querySelector('#mpModalTitle').textContent = isLogin ? 'Sign in to continue' : 'Create your account';
      e.target.textContent = isLogin ? 'Create one' : 'Sign in';
      e.target.parentElement.firstChild.textContent = isLogin ? "Don't have an account? " : 'Already have an account? ';
    });

    overlay.querySelector('#mpModalGoogleBtn').addEventListener('click', async () => {
      errEl.style.display = 'none';
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const cred = await auth.signInWithPopup(provider);
        await db.collection('users').doc(cred.user.uid).set({
          firstName: cred.user.displayName ? cred.user.displayName.split(' ')[0] : '',
          lastName: cred.user.displayName ? cred.user.displayName.split(' ').slice(1).join(' ') : '',
          email: cred.user.email, avatarUrl: cred.user.photoURL || null, updatedAt: TS(),
        }, { merge: true });
        close(); resolve(cred.user);
      } catch (e) { errEl.textContent = e.message; errEl.style.display = ''; }
    });

    overlay.querySelector('#mpModalSubmit').addEventListener('click', async () => {
      errEl.style.display = 'none';
      const email = overlay.querySelector('#mpModalEmail').value.trim();
      const password = overlay.querySelector('#mpModalPassword').value;
      if (!email || !password) { errEl.textContent = 'Please fill all fields'; errEl.style.display = ''; return; }
      const btn = overlay.querySelector('#mpModalSubmit');
      btn.disabled = true;
      try {
        if (isLogin) {
          const cred = await withTimeout(auth.signInWithEmailAndPassword(email, password), 15000);
          close(); resolve(cred.user);
        } else {
          const firstName = overlay.querySelector('#mpModalFirstName').value.trim();
          const lastName = overlay.querySelector('#mpModalLastName').value.trim();
          if (!firstName || !lastName) throw new Error('Please enter your first and last name');
          const cred = await withTimeout(auth.createUserWithEmailAndPassword(email, password), 15000);
          try { await withTimeout(cred.user.updateProfile({ displayName: `${firstName} ${lastName}` }), 15000); } catch(e2) { console.warn('updateProfile failed', e2); }
          await withTimeout(db.collection('users').doc(cred.user.uid).set({ firstName, lastName, email, createdAt: TS() }), 15000);
          close(); resolve(cred.user);
        }
      } catch (e) {
        errEl.textContent = e.message === 'timeout'
          ? 'This is taking too long. Please check your connection and try again.'
          : (e.code === 'auth/email-already-in-use' ? 'This email is already registered. Try signing in.' : e.message);
        errEl.style.display = '';
        btn.disabled = false;
      }
    });
  });
}

async function mpEnsureAuth(subtitle) {
  if (auth.currentUser) return auth.currentUser;
  return mpShowAuthModal(subtitle);
}

function mpRenderAccountBar(container) {
  auth.onAuthStateChanged(user => {
    if (!user) {
      container.innerHTML = `<button class="btn btn-outline" id="mpAcctSignIn" style="font-size:.82rem">Sign In</button>`;
      container.querySelector('#mpAcctSignIn').addEventListener('click', () => mpShowAuthModal('Sign in to message sellers and track your orders.').catch(() => {}));
      return;
    }
    container.innerHTML = `
      <div class="mp-account-bar">
        <img class="mp-account-avatar" src="${user.photoURL || '../assets/images/logo.png'}" />
        <span style="font-size:.85rem">${user.displayName || user.email}</span>
        <a href="inbox.html" class="btn btn-outline" style="font-size:.78rem"><i class="ph-fill ph-chat-circle-text"></i></a>
        <button class="btn btn-outline" id="mpAcctSignOut" style="font-size:.78rem">Sign Out</button>
      </div>`;
    container.querySelector('#mpAcctSignOut').addEventListener('click', () => auth.signOut().then(() => location.reload()));
  });
}

async function mpContactSellerForGig(gig, btn) {
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = 'Opening chat…';
  try {
    await mpEnsureAuth('Sign in to message this seller.');
    const sellerDoc = await db.collection('sellers').doc(gig.sellerId).get();
    const sellerInfo = sellerDoc.exists ? sellerDoc.data() : {};
    const threadId = await mpOpenThread(gig.sellerId, sellerInfo.businessName || `${sellerInfo.firstName || ''} ${sellerInfo.lastName || ''}`.trim(), sellerInfo.avatarUrl, gig);
    mpOpenChatPanel(threadId);
  } catch (e) {
    if (e.message !== 'cancelled') alert(e.message);
  } finally {
    btn.disabled = false; btn.textContent = orig;
  }
}

/* ================================================================
   INLINE CHAT PANEL — lets a buyer chat with the seller/agent right on
   the gig page, without leaving to a separate inbox page.
   ================================================================ */
let _mpPanelUnsub = null;

function mpCloseChatPanel() {
  if (_mpPanelUnsub) { _mpPanelUnsub(); _mpPanelUnsub = null; }
  const overlay = document.getElementById('mpChatPanelOverlay');
  if (overlay) overlay.remove();
}

async function mpOpenChatPanel(threadId) {
  mpInjectModalStyles();
  mpCloseChatPanel();

  const user = auth.currentUser;
  if (!user) return;

  const overlay = document.createElement('div');
  overlay.className = 'mp-modal-overlay';
  overlay.id = 'mpChatPanelOverlay';
  overlay.innerHTML = `
    <div class="glass-card" style="padding:0;max-width:480px;width:100%;height:min(640px,88vh);display:flex;flex-direction:column;overflow:hidden">
      <div id="mpChatPanelBody" style="flex:1;display:flex;flex-direction:column;overflow:hidden">
        <div style="text-align:center;padding:80px 20px"><i class="ph-fill ph-circle-notch spin" style="font-size:2rem;color:var(--accent-1)"></i></div>
      </div>
    </div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) mpCloseChatPanel(); });
  document.body.appendChild(overlay);

  const body = document.getElementById('mpChatPanelBody');

  let thread;
  try {
    const doc = await db.collection('mp_threads').doc(threadId).get();
    if (!doc.exists) throw new Error('Conversation not found.');
    thread = doc.data();
    if (!(thread.participants || []).includes(user.uid)) throw new Error("You don't have access to this conversation.");
  } catch (e) {
    body.innerHTML = `<p style="color:#ef4444;text-align:center;padding:60px 20px">${e.message}</p>`;
    return;
  }

  const otherUid = thread.participants.find(p => p !== user.uid);
  const otherInfo = (thread.participantInfo && thread.participantInfo[otherUid]) || {};

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--border)">
      <img src="${otherInfo.avatarUrl || '../assets/images/logo.png'}" style="width:38px;height:38px;border-radius:50%;object-fit:cover" />
      <div style="flex:1;min-width:0">
        <h4 style="margin:0;font-size:.92rem">${otherInfo.name || 'Seller'}</h4>
        ${thread.gigTitle ? `<p style="margin:1px 0 0;font-size:.76rem;color:var(--accent-1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${thread.gigTitle}</p>` : ''}
      </div>
      <a href="inbox.html?thread=${threadId}" title="Open in inbox" style="color:var(--text-muted);font-size:1rem"><i class="ph-fill ph-arrow-square-out"></i></a>
      <button id="mpChatPanelClose" style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;line-height:1">✕</button>
    </div>
    <div id="mpPanelMessages" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:16px"></div>
    <div style="display:flex;gap:10px;padding:14px 16px;border-top:1px solid var(--border)">
      <input type="text" id="mpPanelMsgInput" placeholder="Type a message…" style="flex:1;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:12px 14px;color:var(--text-primary);font-size:.9rem" />
      <button class="btn btn-primary" id="mpPanelMsgSend"><i class="ph-fill ph-paper-plane-tilt"></i></button>
    </div>
    <div id="mpPanelMsgErr" style="color:#ef4444;font-size:.8rem;padding:0 16px 10px;display:none"></div>`;

  document.getElementById('mpChatPanelClose').addEventListener('click', mpCloseChatPanel);

  const msgsEl = document.getElementById('mpPanelMessages');
  _mpPanelUnsub = db.collection('mp_threads').doc(threadId).collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      msgsEl.innerHTML = snap.docs.map(d => {
        const m = d.data();
        const mine = m.senderId === user.uid;
        return `<div style="align-self:${mine ? 'flex-end' : 'flex-start'};max-width:80%;background:${mine ? 'var(--accent-1)' : 'var(--bg-card)'};color:${mine ? '#fff' : 'var(--text-primary)'};padding:10px 14px;border-radius:14px;font-size:.88rem;word-wrap:break-word">${m.text}</div>`;
      }).join('');
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }, err => {
      msgsEl.innerHTML = `<p style="color:#ef4444">Could not load messages: ${err.message}</p>`;
    });

  const send = async () => {
    const input = document.getElementById('mpPanelMsgInput');
    const text = input.value.trim();
    if (!text) return;
    const errEl = document.getElementById('mpPanelMsgErr');
    errEl.style.display = 'none';
    input.value = '';
    try {
      await db.collection('mp_threads').doc(threadId).collection('messages').add({
        senderId: user.uid, text, createdAt: TS(),
      });
      await db.collection('mp_threads').doc(threadId).update({
        lastMessage: text, lastMessageAt: TS(), lastSenderId: user.uid,
      });
    } catch (e) {
      errEl.textContent = e.message; errEl.style.display = '';
    }
  };
  document.getElementById('mpPanelMsgSend').addEventListener('click', send);
  document.getElementById('mpPanelMsgInput').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  document.getElementById('mpPanelMsgInput').focus();
}

/* ================================================================
   PUBLIC GIG BROWSING — search + category filter over published gigs
   ================================================================ */
function initGigsPage() {
  const app = document.getElementById('gigsApp');
  if (!app) return;
  mpRenderPublicGigs(app);
}

async function mpRenderPublicGigs(app) {
  app.innerHTML = '<div style="text-align:center;padding:80px 20px"><i class="ph-fill ph-circle-notch spin" style="font-size:2rem;color:var(--accent-1)"></i></div>';

  let gigs = [];
  try {
    const snap = await db.collection('gigs').where('status', '==', 'published').get();
    gigs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    app.innerHTML = `<p style="color:#ef4444;text-align:center;padding:60px 20px">Could not load gigs: ${e.message}</p>`;
    return;
  }

  app.innerHTML = `
  <div style="max-width:1080px;margin:0 auto;padding:40px 20px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:6px">
      <div>
        <h2 style="margin-bottom:4px">Browse Services</h2>
        <p style="color:var(--text-muted);font-size:.9rem;margin:0">Hire a freelancer for your next project.</p>
      </div>
      <div id="mpAccountBar"></div>
    </div>

    <div style="display:flex;gap:12px;flex-wrap:wrap;margin:24px 0">
      <input type="text" id="mpGigSearch" placeholder="Search gigs…" style="flex:1;min-width:200px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:11px 14px;color:var(--text-primary);font-size:.88rem" />
      <select id="mpGigCategory" style="min-width:220px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:11px 14px;color:var(--text-primary);font-size:.88rem">
        <option value="">All categories</option>
        ${MP_SERVICES.map(s => `<option value="${s.id}">${s.label}</option>`).join('')}
      </select>
    </div>

    <div id="mpGigResults"></div>
  </div>`;

  mpRenderAccountBar(document.getElementById('mpAccountBar'));

  const resultsEl = document.getElementById('mpGigResults');
  const renderResults = (list) => {
    if (!list.length) {
      resultsEl.innerHTML = `
        <div class="glass-card" style="padding:48px;text-align:center">
          <i class="ph-fill ph-briefcase" style="font-size:2.2rem;color:var(--accent-1);margin-bottom:12px"></i>
          <h3 style="margin-bottom:6px">${gigs.length === 0 ? 'No gigs published yet' : 'No gigs match your search'}</h3>
          <p style="color:var(--text-muted);font-size:.9rem">${gigs.length === 0 ? 'Check back soon.' : 'Try a different search term or category.'}</p>
        </div>`;
      return;
    }
    resultsEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px">
        ${list.map(g => `
          <div class="glass-card" style="padding:0;overflow:hidden;display:flex;flex-direction:column">
            <a href="gig.html?id=${g.id}" style="display:block">
              <img src="${(g.images && g.images[0]) || '../assets/images/logo.png'}" style="width:100%;height:150px;object-fit:cover" />
            </a>
            <div style="padding:16px;display:flex;flex-direction:column;flex:1">
              <p style="font-size:.75rem;color:var(--accent-1);margin:0 0 4px">${mpGetSub(g.service, g.subService)?.label || ''}</p>
              <a href="gig.html?id=${g.id}" style="text-decoration:none;color:inherit"><h4 style="margin:0 0 8px;font-size:.94rem">${g.title}</h4></a>
              <p style="color:var(--text-muted);font-size:.82rem;margin:0 0 14px;flex:1">From ${g.pricingTiers?.[0]?.price ?? '—'}</p>
              <div style="display:flex;gap:8px">
                <a href="gig.html?id=${g.id}" class="btn btn-outline" style="font-size:.8rem;flex:1;text-align:center">View</a>
                <button class="btn btn-primary mp-contact-seller" data-gig="${g.id}" style="font-size:.8rem;flex:1">Message</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
    resultsEl.querySelectorAll('.mp-contact-seller').forEach(btn => {
      btn.addEventListener('click', () => mpContactSellerForGig(list.find(g => g.id === btn.dataset.gig), btn));
    });
  };

  const applyFilters = () => {
    const q = document.getElementById('mpGigSearch').value.trim().toLowerCase();
    const cat = document.getElementById('mpGigCategory').value;
    let list = gigs;
    if (cat) list = list.filter(g => g.service === cat);
    if (q) list = list.filter(g =>
      (g.title || '').toLowerCase().includes(q) ||
      (g.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (mpGetSub(g.service, g.subService)?.label || '').toLowerCase().includes(q)
    );
    renderResults(list);
  };

  renderResults(gigs);
  document.getElementById('mpGigSearch').addEventListener('input', applyFilters);
  document.getElementById('mpGigCategory').addEventListener('change', applyFilters);
}

/* ================================================================
   GIG DETAIL PAGE
   ================================================================ */
function initGigDetailPage() {
  const app = document.getElementById('gigDetailApp');
  if (!app) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { app.innerHTML = '<p style="text-align:center;padding:60px 20px;color:#ef4444">No gig specified.</p>'; return; }
  mpRenderGigDetail(app, id);
}

async function mpRenderGigDetail(app, gigId) {
  app.innerHTML = '<div style="text-align:center;padding:80px 20px"><i class="ph-fill ph-circle-notch spin" style="font-size:2rem;color:var(--accent-1)"></i></div>';

  let gig, seller;
  try {
    const gigDoc = await db.collection('gigs').doc(gigId).get();
    if (!gigDoc.exists) throw new Error('This gig could not be found.');
    gig = { id: gigDoc.id, ...gigDoc.data() };
    const sellerDoc = await db.collection('sellers').doc(gig.sellerId).get();
    seller = sellerDoc.exists ? sellerDoc.data() : {};
  } catch (e) {
    app.innerHTML = `<p style="color:#ef4444;text-align:center;padding:60px 20px">${e.message}</p>`;
    return;
  }

  const tiers = gig.pricingTiers || [];
  const images = gig.images && gig.images.length ? gig.images : ['../assets/images/logo.png'];

  app.innerHTML = `
  <div style="max-width:1080px;margin:0 auto;padding:32px 20px">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:20px">
      <a href="gigs.html" style="font-size:.85rem;color:var(--text-muted)"><i class="ph-fill ph-arrow-left"></i> Back to browsing</a>
      <div id="mpAccountBar"></div>
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:32px;align-items:start" id="mpGigDetailGrid">
      <div>
        <p style="font-size:.78rem;color:var(--accent-1);margin:0 0 6px">${mpGetSub(gig.service, gig.subService)?.label || ''}</p>
        <h1 style="font-size:1.6rem;margin:0 0 20px">${gig.title}</h1>

        <img src="${images[0]}" style="width:100%;max-height:380px;object-fit:cover;border-radius:14px;margin-bottom:10px" />
        ${images.length > 1 ? `<div style="display:flex;gap:8px;margin-bottom:28px">
          ${images.slice(1).map(src => `<img src="${src}" style="width:90px;height:70px;object-fit:cover;border-radius:8px" />`).join('')}
        </div>` : '<div style="margin-bottom:28px"></div>'}

        <h3 style="margin-bottom:10px">About this gig</h3>
        <p style="color:var(--text-secondary);font-size:.92rem;line-height:1.7;white-space:pre-wrap;margin-bottom:28px">${gig.description || ''}</p>

        ${gig.faq && gig.faq.length ? `
          <h3 style="margin-bottom:12px">FAQ</h3>
          <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:28px">
            ${gig.faq.map(f => `
              <div class="glass-card" style="padding:14px 16px">
                <p style="margin:0 0 4px;font-weight:600;font-size:.88rem">${f.question || ''}</p>
                <p style="margin:0;font-size:.85rem;color:var(--text-muted)">${f.answer || ''}</p>
              </div>`).join('')}
          </div>` : ''}

        <div class="glass-card" style="padding:20px;display:flex;align-items:center;gap:14px">
          <img src="${seller.avatarUrl || '../assets/images/logo.png'}" style="width:54px;height:54px;border-radius:50%;object-fit:cover" />
          <div style="flex:1">
            <h4 style="margin:0 0 2px">${seller.businessName || `${seller.firstName || ''} ${seller.lastName || ''}`.trim() || 'Seller'}</h4>
            <p style="margin:0;font-size:.8rem;color:var(--text-muted)">${seller.country || ''}</p>
          </div>
          <button class="btn btn-outline" id="mpDetailContactSeller" style="font-size:.82rem">Contact Seller</button>
        </div>
      </div>

      <div style="position:sticky;top:20px">
        <div class="glass-card" style="padding:0;overflow:hidden">
          <div style="display:flex;border-bottom:1px solid var(--border)">
            ${tiers.map((t, i) => `<div class="mp-detail-tier-tab${i === 0 ? ' active' : ''}" data-idx="${i}" style="flex:1;text-align:center;padding:12px;font-size:.82rem;font-weight:600;cursor:pointer;${i === 0 ? 'color:var(--accent-1);border-bottom:2px solid var(--accent-1)' : 'color:var(--text-muted)'}">${t.name || t.tier}</div>`).join('')}
          </div>
          <div id="mpDetailTierBody" style="padding:20px"></div>
        </div>
      </div>
    </div>
  </div>
  <style>@media (max-width: 760px) { #mpGigDetailGrid { grid-template-columns: 1fr !important; } }</style>`;

  mpRenderAccountBar(document.getElementById('mpAccountBar'));

  const tierBody = document.getElementById('mpDetailTierBody');
  const renderTier = (idx) => {
    const t = tiers[idx];
    if (!t) { tierBody.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem">No pricing set.</p>'; return; }
    tierBody.innerHTML = `
      <div style="font-size:1.5rem;font-weight:700;margin-bottom:10px">${t.price ? '$' + t.price : '—'}</div>
      <div style="display:flex;justify-content:space-between;font-size:.82rem;color:var(--text-muted);margin-bottom:8px"><span>Delivery time</span><span>${t.deliveryDays || '—'} days</span></div>
      <div style="display:flex;justify-content:space-between;font-size:.82rem;color:var(--text-muted);margin-bottom:20px"><span>Revisions</span><span>${t.revisions ?? '—'}</span></div>
      <button class="btn btn-primary mp-detail-continue" style="width:100%">Continue</button>`;
    tierBody.querySelector('.mp-detail-continue').addEventListener('click', (e) => mpContactSellerForGig(gig, e.target));
  };
  renderTier(0);
  document.querySelectorAll('.mp-detail-tier-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mp-detail-tier-tab').forEach(t => { t.classList.remove('active'); t.style.color = 'var(--text-muted)'; t.style.borderBottom = 'none'; });
      tab.classList.add('active'); tab.style.color = 'var(--accent-1)'; tab.style.borderBottom = '2px solid var(--accent-1)';
      renderTier(Number(tab.dataset.idx));
    });
  });

  document.getElementById('mpDetailContactSeller').addEventListener('click', (e) => mpContactSellerForGig(gig, e.target));
}

document.addEventListener('DOMContentLoaded', () => {
  initSellerPage();
  initInboxPage();
  initGigDetailPage();
  initGigsPage();
});
