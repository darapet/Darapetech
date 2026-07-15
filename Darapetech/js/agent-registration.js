/* =====================================================================
   DARAPET TECHNOLOGY — AGENT SELF-REGISTRATION
   Stores applications in Firestore: agent_applications (status: pending)
   ===================================================================== */
(function () {
  'use strict';

  /* ── Service → Niche map ── */
  const SERVICE_NICHES = {
    'Web & App Development': [
      'Website Development','WordPress Development','Shopify Development',
      'Mobile App Development','React.js / Next.js','Vue.js / Nuxt.js',
      'Node.js / Express','PHP Development','E-Commerce Stores',
      'Landing Page Design','Web Maintenance & Support','UI/UX Design & Prototyping',
      'API & Backend Development','Custom Web Applications'
    ],
    'Video Editing': [
      'YouTube Videos','Short-Form Reels & TikTok','Corporate / Brand Videos',
      'Motion Graphics & Animation','Color Grading & Sound Design',
      'Podcast Video Production','Wedding & Event Coverage',
      'Video Ads & Commercials','After Effects & VFX','Subtitles & Captions'
    ],
    'Graphics & Design': [
      'Logo Design & Brand Identity','Social Media Graphics',
      'Print Design (Flyers, Banners)','UI/UX Design','Packaging Design',
      'Infographics & Data Visualisation','Pitch Decks & Presentations',
      'Illustrations & Artwork','Icon & Avatar Design',
      'Business Cards & Stationery'
    ],
    'Digital Marketing': [
      'SEO (Search Engine Optimisation)','Google Ads / PPC',
      'Facebook & Instagram Ads','TikTok Ads',
      'Social Media Management','Content Strategy & Copywriting',
      'Influencer Marketing','YouTube SEO & Growth',
      'Marketing Funnels & Automation','Analytics & Reporting'
    ],
    'Email Marketing': [
      'Email Campaign Design','Newsletter Creation',
      'Drip & Automation Flows','List Building & Segmentation',
      'Lead Nurturing Sequences','Mailchimp','Klaviyo','Brevo/Sendinblue',
      'CRM Integration','Email Analytics & Deliverability'
    ]
  };

  let currentStep   = 1;
  let uploadedPhotoUrl = '';
  let photoFile       = null;

  /* ── Display name auto-generator ── */
  function generateDisplayName(first, last) {
    const f = (first || '').trim();
    const l = (last  || '').trim();
    if (!f) return '';
    if (!l) return f;
    // "John Doe" → "JohnD" — meaningful short form
    return f + l.charAt(0).toUpperCase();
  }

  /* ── Step progress UI ── */
  function updateStepUI(step) {
    [1, 2, 3].forEach(n => {
      const circle = document.getElementById('sc' + n);
      const label  = document.getElementById('sl' + n);
      circle.classList.remove('active', 'done');
      label.classList.remove('active');
      if (n < step)  { circle.classList.add('done'); circle.innerHTML = '<i class="fas fa-check" style="font-size:.65rem"></i>'; }
      if (n === step){ circle.classList.add('active'); circle.textContent = n; }
      if (n > step)  { circle.textContent = n; }
      if (n === step) label.classList.add('active');
    });
    [1, 2].forEach(n => {
      const line = document.getElementById('line' + n);
      line.classList.toggle('done', n < step);
    });
  }

  function showStep(n) {
    currentStep = n;
    document.querySelectorAll('.step-content').forEach(s => s.classList.remove('active'));
    document.getElementById('step' + n).classList.add('active');
    updateStepUI(n);
    clearErr();
  }

  function showErr(msg) {
    const e = document.getElementById('agentRegErr');
    e.textContent = msg; e.style.display = 'block';
    e.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearErr() {
    const e = document.getElementById('agentRegErr');
    e.style.display = 'none'; e.textContent = '';
  }

  /* ── Display name live preview ── */
  ['regFirst', 'regLast'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      const first = document.getElementById('regFirst').value;
      const last  = document.getElementById('regLast').value;
      const auto  = generateDisplayName(first, last);
      document.getElementById('displayNamePreview').textContent = auto || '—';
      const dn = document.getElementById('regDisplayName');
      if (!dn.dataset.manuallyEdited) dn.value = auto;
    });
  });
  document.getElementById('regDisplayName').addEventListener('input', function() {
    this.dataset.manuallyEdited = this.value ? '1' : '';
    document.getElementById('displayNamePreview').textContent = this.value || generateDisplayName(
      document.getElementById('regFirst').value,
      document.getElementById('regLast').value
    ) || '—';
  });

  /* ── Service select → populate niches ── */
  document.getElementById('regService').addEventListener('change', function() {
    const service = this.value;
    const nicheWrap = document.getElementById('nicheWrap');
    const nicheSelect = document.getElementById('regNiche');
    if (!service) { nicheWrap.style.display = 'none'; return; }
    const niches = SERVICE_NICHES[service] || [];
    nicheSelect.innerHTML = '<option value="">— Select your niche —</option>' +
      niches.map(n => `<option value="${n}">${n}</option>`).join('');
    nicheWrap.style.display = 'block';
  });

  /* ── Photo file selection & preview ── */
  document.getElementById('regPhotoInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      const pe = document.getElementById('photoErr');
      pe.textContent = 'File too large. Maximum size is 5MB.'; pe.style.display = 'block';
      this.value = ''; return;
    }
    document.getElementById('photoErr').style.display = 'none';
    photoFile = file;
    const reader = new FileReader();
    reader.onload = ev => {
      const ph = document.getElementById('photoPh');
      ph.innerHTML = `<img src="${ev.target.result}" style="width:72px;height:72px;border-radius:50%;object-fit:cover" />`;
    };
    reader.readAsDataURL(file);
  });

  /* ── Step navigation ── */
  document.getElementById('nextStep1').addEventListener('click', () => {
    const first = document.getElementById('regFirst').value.trim();
    const last  = document.getElementById('regLast').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    if (!first)  { showErr('Please enter your first name.'); return; }
    if (!last)   { showErr('Please enter your last name.');  return; }
    if (!email)  { showErr('Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showErr('Please enter a valid email address.'); return; }
    if (!phone)  { showErr('Please enter your phone number.'); return; }
    showStep(2);
  });

  document.getElementById('backStep2').addEventListener('click', () => showStep(1));
  document.getElementById('nextStep2').addEventListener('click', () => {
    const service = document.getElementById('regService').value;
    const niche   = document.getElementById('regNiche').value;
    if (!service) { showErr('Please select your main service area.'); return; }
    if (!niche)   { showErr('Please select your specific niche.'); return; }
    showStep(3);
  });
  document.getElementById('backStep3').addEventListener('click', () => showStep(2));

  /* ── Generate short Application ID ── */
  function genAppId() {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).slice(2, 5).toUpperCase();
    return 'APP-' + ts + rnd;
  }

  /* ── Upload photo to Cloudinary (optional) ── */
  async function uploadPhoto(file) {
    const cfgDoc = await db.collection('settings').doc('cloudinary').get();
    if (!cfgDoc.exists) throw new Error('no-cloudinary');
    const { cloudName, uploadPreset } = cfgDoc.data();
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', uploadPreset);
    fd.append('folder', 'agent-applications');
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!data.secure_url) throw new Error(data.error?.message || 'Upload failed');
    return data.secure_url;
  }

  /* ── Submit registration ── */
  document.getElementById('submitRegBtn').addEventListener('click', async () => {
    const btn     = document.getElementById('submitRegBtn');
    const progress = document.getElementById('photoProgress');
    const first   = document.getElementById('regFirst').value.trim();
    const last    = document.getElementById('regLast').value.trim();
    const email   = document.getElementById('regEmail').value.trim();
    const phone   = document.getElementById('regPhone').value.trim();
    const service = document.getElementById('regService').value;
    const niche   = document.getElementById('regNiche').value;
    let displayName = document.getElementById('regDisplayName').value.trim() || generateDisplayName(first, last);

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting…';

    // Try to upload photo
    if (photoFile) {
      progress.style.display = 'block';
      progress.textContent   = 'Uploading photo…';
      try {
        uploadedPhotoUrl = await uploadPhoto(photoFile);
        progress.textContent = '✓ Photo uploaded';
      } catch (err) {
        if (err.message !== 'no-cloudinary') {
          console.warn('Photo upload failed:', err.message);
        }
        // Continue without photo if Cloudinary not configured
        uploadedPhotoUrl = '';
        progress.style.display = 'none';
      }
    }

    const appId = genAppId();
    try {
      await db.collection('agent_applications').add({
        appId,
        firstName:   first,
        lastName:    last,
        fullName:    `${first} ${last}`,
        displayName: displayName,
        email,
        phone,
        service,
        niche,
        photoUrl:    uploadedPhotoUrl,
        status:      'pending',
        submittedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Show success screen
      document.getElementById('stepBar').style.display     = 'none';
      document.getElementById('agentRegErr').style.display = 'none';
      document.querySelectorAll('.step-content').forEach(s => s.style.display = 'none');
      document.getElementById('applicationId').textContent = appId;
      document.getElementById('successScreen').style.display = 'block';

    } catch (err) {
      showErr('Submission failed: ' + (err.message || 'Unknown error. Please try again.'));
      btn.disabled = false;
      btn.innerHTML = 'Submit Application <i class="fas fa-paper-plane"></i>';
      progress.style.display = 'none';
    }
  });

})();
