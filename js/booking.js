/* ==============================================================
   booking.js — appointment request form
   Service picker, add-ons, and submission to the CRM (Supabase)
   plus the Formspree email backup.
   Loaded on book.html only. Functions here are called from onclick="..." there.
   ============================================================== */

/* ----------------------------------------------------------
   1. SERVICE DROPDOWN
---------------------------------------------------------- */
let selectedService = '';   // full name included in the emailed request
let selectedAddons  = [];

function toggleDropdown() {
  document.getElementById('svcDropdown').classList.toggle('open');
}

document.addEventListener('click', e => {
  const dd = document.getElementById('svcDropdown');
  if (dd && !dd.contains(e.target)) dd.classList.remove('open');
});

function pickService(optionEl, fullName, displayName) {
  document.querySelectorAll('.svc-option').forEach(o => o.classList.remove('active'));
  optionEl.classList.add('active');

  selectedService = fullName;

  const trigger = document.getElementById('svcTrigger');
  document.getElementById('triggerText').textContent = displayName;
  trigger.classList.add('selected');

  document.getElementById('chipText').textContent = displayName;
  document.getElementById('selectedChip').classList.add('visible');

  document.getElementById('continueBtn').classList.add('visible');

  document.getElementById('svcDropdown').classList.remove('open');
}

function changeService() {
  document.getElementById('svcDropdown').classList.add('open');
}

/* ----------------------------------------------------------
   2. ADDON TOGGLES
---------------------------------------------------------- */
function toggleAddon(btn, addonName) {
  if (btn.classList.contains('active')) {
    btn.classList.remove('active');
    selectedAddons = selectedAddons.filter(a => a !== addonName);
  } else {
    btn.classList.add('active');
    selectedAddons.push(addonName);
  }
}

/* ----------------------------------------------------------
   3. CONTINUE BUTTON — reveals the request form
---------------------------------------------------------- */
function revealForm() {
  if (!selectedService) return;

  const prompt = document.getElementById('calPrompt');
  const wrap   = document.getElementById('calWrap');

  prompt.style.display = 'none';
  wrap.style.display   = 'block';

  setTimeout(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
}

/* ----------------------------------------------------------
   4. FORM SUBMISSION
   1) Saves the request straight into the CRM database
      (Supabase) so it appears in admin.html automatically.
   2) Also emails it to you via Formspree as a backup.
---------------------------------------------------------- */
// earliest bookable day = tomorrow (local time)
(function () {
  const d = new Date(); d.setDate(d.getDate() + 1);
  const el = document.getElementById('reqDate');
  if (el) el.min = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
})();

async function submitRequest(event) {
  event.preventDefault();

  const form = event.target;
  const submitBtn = document.getElementById('requestSubmitBtn');

  document.getElementById('formService').value =
    selectedService || 'Not selected';
  document.getElementById('formAddons').value =
    selectedAddons.length ? selectedAddons.join(', ') : 'None';

  submitBtn.disabled = true;
  submitBtn.textContent = 'SENDING...';

  try {
    /* 1) → CRM database (best effort; email below never depends on it) */
    const crmStatusEl = document.getElementById('crmStatus');
    if (crmStatusEl) crmStatusEl.textContent = '';
    try {
      const sb = window.PF_SUPABASE;
      if (sb && sb.url && sb.key) {
        const lead = {
          name:    document.getElementById('reqName').value.trim(),
          phone:   document.getElementById('reqPhone').value.trim(),
          email:   document.getElementById('reqEmail').value.trim(),
          address: document.getElementById('reqAddress').value.trim(),
          service: selectedService || '',
          addons:  selectedAddons.slice(),
          notes:   document.getElementById('reqNotes').value.trim(),
          preferredDate: document.getElementById('reqDate').value,   // YYYY-MM-DD
          preferredTime: document.getElementById('reqTime').value,
          submittedAt: new Date().toISOString()
        };
        // The website_leads table has ONE jsonb column called "payload" (that's what the CRM reads),
        // so the lead must be wrapped in it — flat columns get rejected by Supabase.
        const payload = { payload: lead };
        if (!lead.name || !lead.phone || !lead.service) {
          throw new Error('missing required fields');
        }
        const crmHeaders = {
          'apikey': sb.key,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        };
        // legacy JWT keys (ey…) also go in Authorization; publishable keys must not
        if (/^eyJ/.test(sb.key)) crmHeaders['Authorization'] = 'Bearer ' + sb.key;
        const crmRes = await fetch(sb.url + '/rest/v1/website_leads', {
          method: 'POST',
          headers: crmHeaders,
          body: JSON.stringify(payload)
        });
        if (!crmRes.ok) {
          let detail = '';
          try { detail = await crmRes.text(); } catch (e) {}
          throw new Error('CRM insert failed (HTTP ' + crmRes.status + ') ' + detail);
        }
        if (crmStatusEl) crmStatusEl.textContent = '✓ Also saved to CRM — it appears automatically for the owner.';
      } else if (crmStatusEl) {
        crmStatusEl.textContent = 'ℹ Sent by email. (CRM auto-save not available on this page load — reload the page if setup was just completed.)';
      }
    } catch (crmErr) {
      console.warn('CRM save skipped:', crmErr);
      if (crmStatusEl) crmStatusEl.textContent = 'ℹ Sent by email. (CRM auto-save not available on this page load — if setup was just completed, reload the page.)';
    }

    /* 2) → email backup (Formspree) */
    const response = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) throw new Error('Request failed');

    form.style.display = 'none';
    document.getElementById('requestSuccess').style.display = 'block';

  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'REQUEST THE APPOINTMENT';
    alert('Something went wrong sending your request. Please call or text us directly at 315-641-9988.');
  }
}

/* ----------------------------------------------------------
   5. PRESELECT FROM LINK
   services.html links here as book.html?pkg=exec&veh=suv —
   pick that service automatically.
---------------------------------------------------------- */
(function preselectFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const pkg = params.get('pkg');
  if (!pkg) return;
  const veh = params.get('veh') === 'suv' ? 'suv' : 'sedan';
  const opt = document.querySelector(`.svc-option[data-key="${CSS.escape(pkg)}-${veh}"]`);
  if (opt) opt.click();
})();
