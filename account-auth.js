// ====================
// JMPOTTERS ACCOUNT & AUTH (shared module)
// =============================================================
// Loaded after app.js on every storefront page. Owns:
//   1. Auth state resolution (localStorage OR sessionStorage jmpotters_user)
//   2. Account icon injection & rendering in the existing header
//   3. Account slide-down panel (rendered lazily on first open)
//   4. Profile picture upload (Supabase `profile-pictures` bucket + localStorage mirror)
//   5. Sign-out that wipes both storages and the avatar cache
// =============================================================
//
// SUPABASE SETUP (one-time, do this in the Supabase dashboard BEFORE publishing):
//   1. Storage → New bucket → name: `profile-pictures` → Public: ON.
//      Recommended file-size limit: 2 MB. Allowed MIME types: image/jpeg, image/png, image/webp.
//   2. Storage → Policies → `profile-pictures` bucket → New policy:
//      - Policy name: `users_upload_own_avatar`
//      - Allowed operation: INSERT
//      - Target roles: anon
//      - WITH CHECK expression: bucket_id = 'profile-pictures'
//      (For v1 we accept anonymous uploads gated by client validation. Tighten later if needed.)
//   3. SQL editor → run:
//        ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avatar_url text;
//      (Optional — without this column the upload still works because we store
//      the URL in localStorage and on the user object. Run it for a permanent copy.)
//
// If the bucket is missing, uploads fail with a friendly in-app error that
// links to this comment, and the rest of the site keeps working.
// =============================================================
(function() {
    'use strict';

    if (window.JMPOTTERS_ACCOUNT_INITIALIZED) {
        console.warn('JMPOTTERS account module already initialized, skipping');
        return;
    }
    console.log('👤 JMPOTTERS account module starting');
    window.JMPOTTERS_ACCOUNT_INITIALIZED = true;

    // ===========================================
    // Public anon credentials (must match login.html / register.html)
    // ===========================================
    const SUPABASE_URL = 'https://tmpggeeuwdvlngvfncaa.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtcGdnZWV1d2R2bG5ndmZuY2FhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxOTc0MDYsImV4cCI6MjA3Nzc3MzQwNn0.EKzkKWmzYMvQuN11vEjRTDHrUbh6dYXk7clxVsYQ0b4';
    const AVATAR_BUCKET = 'profile-pictures';
    const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
    const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

    // ===========================================
    // Local helpers
    // ===========================================
    function safeJsonParse(key, fallback, source) {
        try {
            const raw = source.getItem(key);
            if (!raw) return fallback;
            return JSON.parse(raw) || fallback;
        } catch (e) {
            return fallback;
        }
    }

    function escapeHtml(text) {
        if (text == null) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    function getSupabase() {
        if (window.JMPOTTERS_SUPABASE_CLIENT) return window.JMPOTTERS_SUPABASE_CLIENT;
        if (typeof window.getSupabaseClient === 'function') {
            try {
                const c = window.getSupabaseClient();
                if (c) return c;
            } catch (_) {}
        }
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            try {
                window.JMPOTTERS_SUPABASE_CLIENT = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
                return window.JMPOTTERS_SUPABASE_CLIENT;
            } catch (_) {
                return null;
            }
        }
        return null;
    }

    // Forward to app.js's showNotification when it's available; otherwise render
    // a minimal standalone toast so this file works on pages that don't import app.js.
    function notify(message, type) {
        type = type || 'info';
        if (typeof window.showNotification === 'function') {
            try { window.showNotification(message, type); return; } catch (_) {}
        }
        let container = document.getElementById('jmpottersNotificationContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'jmpottersNotificationContainer';
            container.style.cssText = 'position:fixed;top:80px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:12px;pointer-events:none;';
            document.body.appendChild(container);
            // Inject slide-in animation
            if (!document.getElementById('jmpottersAccountNotifyAnim')) {
                const style = document.createElement('style');
                style.id = 'jmpottersAccountNotifyAnim';
                style.textContent = '@keyframes jmpottersAccountToastIn { from {opacity:0;transform:translateX(20px);} to {opacity:1;transform:translateX(0);} }';
                document.head.appendChild(style);
            }
        }
        const colors = {
            success: { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
            error:   { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
            warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
            info:    { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' }
        };
        const c = colors[type] || colors.info;
        const el = document.createElement('div');
        el.style.cssText = 'background:' + c.bg + ';border-left:4px solid ' + c.border + ';border-radius:12px;padding:14px 18px;min-width:280px;max-width:380px;box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);display:flex;align-items:center;gap:12px;color:' + c.text + ';font-size:0.875rem;font-weight:500;pointer-events:auto;animation:jmpottersAccountToastIn 0.3s ease;';
        el.innerHTML = '<span>' + escapeHtml(message) + '</span><button aria-label="dismiss" style="background:none;border:none;margin-left:auto;cursor:pointer;opacity:0.6;color:inherit;font-size:1rem;">✕</button>';
        const btn = el.querySelector('button');
        if (btn) btn.addEventListener('click', () => el.remove());
        container.appendChild(el);
        setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
    }

    // ===========================================
    // Auth state
    // ===========================================
    // login.html writes user data to localStorage when "remember me" is on, and
    // sessionStorage otherwise. We resolve from whichever has it.
    function getCurrentUser() {
        let u = safeJsonParse('jmpotters_user', null, localStorage);
        if (!u) u = safeJsonParse('jmpotters_user', null, sessionStorage);
        return u;
    }

    function _activeStorage() {
        // Whichever storage currently holds jmpotters_user is where we keep it.
        if (sessionStorage.getItem('jmpotters_user') != null) return sessionStorage;
        return localStorage;
    }

    function persistUser(userObj) {
        if (!userObj) return;
        _activeStorage().setItem('jmpotters_user', JSON.stringify(userObj));
    }

    function getCurrentAvatar() {
        const u = getCurrentUser();
        if (u && u.avatar_url) return u.avatar_url;
        // Fallback: localStorage mirror set at upload time.
        return localStorage.getItem('jmpotters_avatar') || null;
    }

    // ===========================================
    // Styles (one-shot)
    // ===========================================
    function injectAccountStyles() {
        if (document.getElementById('jmpottersAccountStyles')) return;
        const css = [
            // Account icon avatar variants
            '#accountIcon .header-icon-circle { width:36px; height:36px; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center; background:linear-gradient(135deg, #111827, #1f2937); color:#fff; }',
            '#accountIcon.has-avatar .header-icon-circle { box-shadow: 0 0 0 2px rgba(17,24,39,0.45); }',
            '#accountIcon.has-avatar img { width:100%; height:100%; object-fit:cover; }',
            '#accountIcon .header-icon-initials { font-family:Inter,sans-serif; font-weight:700; font-size:0.85rem; letter-spacing:0.5px; text-transform:uppercase; }',

            // Drop zone
            '.avatar-dropzone { position:relative; border:2px dashed var(--gray-300); border-radius:var(--radius); padding:18px; text-align:center; transition:var(--transition); background:var(--gray-50); cursor:pointer; }',
            '.avatar-dropzone:hover, .avatar-dropzone.dragging { border-color:#111827; background:#f3f4f6; transform:translateY(-1px); }',
            '.avatar-dropzone input[type="file"] { display:none; }',
            '.avatar-dropzone-icon { font-size:2rem; color:#111827; display:block; margin-bottom:6px; }',
            '.avatar-dropzone-text { font-size:0.85rem; color:var(--gray-700); display:block; font-weight:500; }',
            '.avatar-dropzone-hint { font-size:0.72rem; color:var(--gray-500); display:block; margin-top:3px; }',

            // Avatar preview
            '.avatar-preview { position:relative; display:inline-block; }',
            '.avatar-preview img { width:96px; height:96px; border-radius:50%; object-fit:cover; border:3px solid #111827; box-shadow:0 4px 14px rgba(0,0,0,0.12); }',
            '.avatar-preview .remove-avatar-btn { position:absolute; top:-6px; right:-6px; width:26px; height:26px; background:#ef4444; color:white; border:2px solid white; border-radius:50%; font-size:0.75rem; cursor:pointer; display:flex; align-items:center; justify-content:center; padding:0; transition:transform 0.15s; }',
            '.avatar-preview .remove-avatar-btn:hover { transform:scale(1.08); }',

            // Account panel section labels & rows
            '.account-section { margin-top:18px; padding-top:16px; border-top:1px solid var(--gray-100); }',
            '.account-section:first-of-type { border-top:none; padding-top:0; margin-top:0; }',
            '.account-section-label { font-size:0.7rem; font-weight:700; color:var(--gray-500); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; display:flex; align-items:center; gap:6px; }',
            '.account-section-label i { color:#111827; }',
            '.optional-tag { font-weight:500; color:var(--gray-400); font-size:0.66rem; text-transform:none; letter-spacing:0; margin-left:4px; }',

            '.account-info-row { display:flex; justify-content:space-between; align-items:baseline; padding:10px 0; border-bottom:1px solid var(--gray-100); font-size:0.85rem; gap:10px; }',
            '.account-info-row:last-child { border-bottom:none; }',
            '.account-info-row .lbl { color:var(--gray-500); flex-shrink:0; }',
            '.account-info-row .val { color:var(--gray-800); font-weight:600; text-align:right; word-break:break-word; }',

            // Action rows
            '.account-action-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:var(--radius); text-decoration:none; color:var(--gray-700); font-weight:500; font-size:0.9rem; transition:var(--transition); background:var(--gray-50); margin-bottom:8px; cursor:pointer; border:none; width:100%; font-family:inherit; text-align:left; }',
            '.account-action-row:hover { background:#f3f4f6; color:#111827; }',
            '.account-action-row i.iconify { color:#111827; }',
            '.account-action-row .spacer { flex:1; }',
            '.account-action-row .chev { color:var(--gray-400); }',
            '.account-signout-btn { color:#ef4444; background:transparent; border:1px solid var(--gray-200); }',
            '.account-signout-btn:hover { background:rgba(239,68,68,0.08); color:#dc2626; border-color:rgba(239,68,68,0.3); }',
            '.account-signout-btn i { color:#ef4444; }',

            '.account-panel-greeting { padding:14px 18px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:var(--radius); margin-bottom:16px; font-size:0.9rem; color:var(--gray-700); line-height:1.5; }',

            /* === STRUCTURAL CSS for the account slide-down panel ===
               Without these scoped rules, on storefront pages that do NOT carry
               the cart.html CSS bundle, #accountPanel (which is given the legacy
               class name .cart-slide-panel) renders as static block content
               appended after the footer. Combined with document.body.style.overflow='hidden'
               the page feels frozen and account content appears under the footer.
               Scoping these under #accountPanel / #accountOverlay keeps cart.html's
               .cart-slide-panel/.cart-overlay-panel rules untouched. */
            '#accountOverlay { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,18,25,0.55); backdrop-filter:blur(4px); -webkit-backdrop-filter:blur(4px); z-index:1060; opacity:0; visibility:hidden; transition:opacity 0.25s ease, visibility 0.25s ease; cursor:pointer; }',
            '#accountOverlay.active { opacity:1; visibility:visible; }',
            '#accountPanel { position:fixed; top:0; right:-110%; width:100%; max-width:440px; height:100vh; height:100dvh; background:#ffffff; z-index:1075; visibility:hidden; transition:right 0.4s cubic-bezier(0.165,0.84,0.44,1), visibility 0s linear 0.4s; display:flex; flex-direction:column; box-shadow:-10px 0 40px rgba(0,0,0,0.18); overflow:hidden; }',
            '#accountPanel.active { right:0; visibility:visible; transition:right 0.4s cubic-bezier(0.165,0.84,0.44,1), visibility 0s linear 0s; }',
            '#accountPanel .cart-slide-header { display:flex; align-items:center; justify-content:space-between; padding:18px 22px; border-bottom:1px solid #f3f4f6; background:#ffffff; flex-shrink:0; }',
            "#accountPanel .cart-slide-title { font-family:'Playfair Display',serif; font-size:1.15rem; font-weight:700; color:#111827; }",
            '#accountPanel .close-cart-slide { background:none; border:none; cursor:pointer; padding:8px; border-radius:10px; color:#6b7280; font-size:1.1rem; transition:background 0.2s, color 0.2s; display:flex; align-items:center; justify-content:center; }',
            '#accountPanel .close-cart-slide:hover { background:#f3f4f6; color:#111827; }',
            '#accountPanel .cart-slide-items { flex:1; overflow-y:auto; padding:1rem 1.5rem; }',
            '#accountPanel .cart-slide-footer { padding:12px 22px; border-top:1px solid #f3f4f6; background:#ffffff; flex-shrink:0; }',
            '@media (min-width:768px) { #accountPanel { max-width:460px; } }'
        ].join('\n');
        const style = document.createElement('style');
        style.id = 'jmpottersAccountStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ===========================================
    // Header icon injection
    // ===========================================
    function ensureAccountIcon() {
        injectAccountStyles();
        const cartIcon = document.getElementById('cartIcon');
        if (!cartIcon) return; // No header (admin-only pages).

        let icon = document.getElementById('accountIcon');
        if (!icon) {
            icon = document.createElement('a');
            icon.id = 'accountIcon';
            icon.className = 'header-icon';
            icon.setAttribute('aria-label', 'Account');
            icon.href = '#';
            // Insert before cart: order becomes search | account | cart.
            cartIcon.parentNode.insertBefore(icon, cartIcon);
        }

        renderAccountIcon();

        if (!icon._accountListener) {
            icon._accountListener = true;
            icon.addEventListener('click', onAccountIconClick);
        }
    }

    function renderAccountIcon() {
        const icon = document.getElementById('accountIcon');
        if (!icon) return;
        const u = getCurrentUser();
        const avatar = getCurrentAvatar();

        if (u && avatar) {
            icon.classList.add('has-avatar');
            icon.innerHTML = '<span class="header-icon-circle"><img src="' + escapeHtml(avatar) + '" alt="Profile" /></span>';
        } else if (u) {
            icon.classList.remove('has-avatar');
            const initial = (u.full_name || u.email || '?').trim().charAt(0).toUpperCase();
            icon.innerHTML = '<span class="header-icon-circle"><span class="header-icon-initials">' + escapeHtml(initial) + '</span></span>';
        } else {
            icon.classList.remove('has-avatar');
            icon.innerHTML = '<i class="icon-user"></i>';
        }
    }

    function onAccountIconClick(e) {
        if (e) e.preventDefault();
        const u = getCurrentUser();
        if (!u) {
            window.location.href = 'login.html';
        } else {
            openAccountPanel();
        }
    }

    // ===========================================
    // Account slide-down panel
    // ===========================================
    let accountPanelOpen = false;

    function ensureAccountPanelDom() {
        if (document.getElementById('accountPanel')) return;

        let overlay = document.getElementById('accountOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'accountOverlay';
            overlay.className = 'cart-overlay-panel';
            document.body.appendChild(overlay);
            overlay.addEventListener('click', closeAccountPanel);
        }

        const panel = document.createElement('aside');
        panel.id = 'accountPanel';
        panel.className = 'cart-slide-panel';
        panel.setAttribute('aria-label', 'Account panel');
        document.body.appendChild(panel);

        if (!document._accountEscListener) {
            document._accountEscListener = true;
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape' && accountPanelOpen) closeAccountPanel();
            });
        }
    }

    function openAccountPanel() {
        const u = getCurrentUser();
        if (!u) { window.location.href = 'login.html'; return; }
        ensureAccountPanelDom();
        renderAccountPanel();
        const panel = document.getElementById('accountPanel');
        const overlay = document.getElementById('accountOverlay');
        if (panel) panel.classList.add('active');
        if (overlay) overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        accountPanelOpen = true;
    }

    function closeAccountPanel() {
        const panel = document.getElementById('accountPanel');
        const overlay = document.getElementById('accountOverlay');
        if (panel) panel.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        document.body.style.overflow = '';
        accountPanelOpen = false;
    }

    function renderAccountPanel() {
        const panel = document.getElementById('accountPanel');
        if (!panel) return;
        const u = getCurrentUser();
        if (!u) return;

        const avatar = getCurrentAvatar();
        const initials = (u.full_name || u.email || '?').trim().charAt(0).toUpperCase();
        const firstName = (u.full_name || '').split(' ')[0] || 'friend';

        const avatarBlock = avatar
            ? '<div class="avatar-preview"><img src="' + escapeHtml(avatar) + '" alt="Profile" /><button type="button" class="remove-avatar-btn" id="accountRemoveAvatarBtn" aria-label="Remove profile picture"><i class="icon-x"></i></button></div>'
            : '<div style="display:flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#1f2937,#111827);color:white;font-weight:700;font-size:1.4rem;font-family:Inter,sans-serif;">' + escapeHtml(initials) + '</div>';

        const dropzoneInner = avatar
            ? '<div style="font-size:0.85rem;color:var(--gray-700);">Want a different photo? Drop or click to upload.</div>'
            : '<i class="icon-camera avatar-dropzone-icon"></i><span class="avatar-dropzone-text">Add profile picture</span><span class="avatar-dropzone-hint">JPG / PNG / WebP · Max 2MB · optional</span>';

        panel.innerHTML = [
            '<div class="cart-slide-header">',
                '<span class="cart-slide-title">My Account</span>',
                '<button class="close-cart-slide" id="closeAccountPanelBtn" aria-label="Close account panel"><i class="icon-x"></i></button>',
            '</div>',
            '<div class="cart-slide-items" style="flex:1;overflow-y:auto;padding:1rem 1.5rem;">',
                '<div class="account-panel-greeting">Welcome back,<br><strong style="font-size:1.05rem;">' + escapeHtml(firstName) + '</strong> 👋</div>',

                '<div class="account-section">',
                    '<div class="account-section-label"><i class="icon-camera"></i> Profile Picture<span class="optional-tag">(optional)</span></div>',
                    '<div style="display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;">',
                        avatarBlock,
                        '<div class="avatar-dropzone" id="accountAvatarDrop" style="flex:1;min-width:200px;">',
                            dropzoneInner,
                            '<input type="file" id="accountAvatarInput" accept="image/jpeg,image/png,image/webp" />',
                        '</div>',
                    '</div>',
                    '<div id="accountAvatarError" style="display:none;color:#ef4444;font-size:0.8rem;margin-top:6px;"></div>',
                '</div>',

                '<div class="account-section">',
                    '<div class="account-section-label"><i class="icon-info"></i> Your Details</div>',
                    row('Full Name', u.full_name),
                    row('Email', u.email),
                    row('Phone', u.phone),
                    row('City', (u.city || '—') + (u.state ? ', ' + u.state : '')),
                    row('Address', u.address),
                '</div>',

                '<div class="account-section">',
                    '<div class="account-section-label"><i class="icon-settings"></i> Actions</div>',
                    '<a class="account-action-row" href="account.html"><i class="icon-user"></i><span class="spacer">View full account &amp; orders</span><i class="icon-chevron-right chev"></i></a>',
                    '<button class="account-action-row account-signout-btn" id="accountSignOutBtn" type="button"><i class="icon-log-out"></i><span class="spacer">Sign Out</span></button>',
                '</div>',
            '</div>',
            '<div class="cart-slide-footer" style="background:#f9fafb;">',
                '<div style="font-size:0.72rem;color:var(--gray-500);text-align:center;padding-top:6px;">Profile editing is read-only for now. Updates coming soon.</div>',
            '</div>'
        ].join('');

        wireAccountPanel();
    }

    function row(label, value) {
        return '<div class="account-info-row"><span class="lbl">' + escapeHtml(label) + '</span><span class="val">' + escapeHtml(value || '—') + '</span></div>';
    }

    function wireAccountPanel() {
        const closeBtn = document.getElementById('closeAccountPanelBtn');
        if (closeBtn) closeBtn.addEventListener('click', closeAccountPanel);

        const signoutBtn = document.getElementById('accountSignOutBtn');
        if (signoutBtn) signoutBtn.addEventListener('click', signOut);

        const removeBtn = document.getElementById('accountRemoveAvatarBtn');
        if (removeBtn) removeBtn.addEventListener('click', removeAvatar);

        const dz = document.getElementById('accountAvatarDrop');
        const input = document.getElementById('accountAvatarInput');
        if (dz && input) {
            // The drop-zone itself acts as the click target for the hidden input.
            dz.addEventListener('click', function(e) {
                if (e.target === input) return;
                input.click();
            });
            input.addEventListener('change', function() {
                const f = input.files && input.files[0];
                if (f) handleAvatarFile(f);
            });
            dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('dragging'); });
            dz.addEventListener('dragleave', function(e) { e.preventDefault(); dz.classList.remove('dragging'); });
            dz.addEventListener('drop', function(e) {
                e.preventDefault();
                dz.classList.remove('dragging');
                const f = e.dataTransfer.files && e.dataTransfer.files[0];
                if (f) handleAvatarFile(f);
            });
        }
    }

    // ===========================================
    // Avatar upload / remove
    // ===========================================
    function showAvatarError(message) {
        const errEl = document.getElementById('accountAvatarError');
        if (errEl) {
            errEl.textContent = message;
            errEl.style.display = 'block';
            clearTimeout(errEl._t);
            errEl._t = setTimeout(() => { if (errEl) errEl.style.display = 'none'; }, 5000);
        }
        notify(message, 'error');
    }

    function handleAvatarFile(file) {
        if (!file) return;
        if (file.size > MAX_AVATAR_BYTES) {
            showAvatarError('Image must be 2MB or smaller.');
            return;
        }
        if (ALLOWED_AVATAR_TYPES.indexOf(file.type) === -1) {
            showAvatarError('Only JPG, PNG or WebP images are accepted.');
            return;
        }
        uploadAvatar(file);
    }

    async function uploadAvatar(file) {
        const u = getCurrentUser();
        if (!u) return;

        const sb = getSupabase();
        if (!sb) {
            showAvatarError('Cannot connect to the server. Please refresh and try again.');
            return;
        }

        notify('Uploading profile picture...', 'info');

        try {
            const extRaw = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
            const ext = extRaw || (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg');
            const fileName = u.id + '_' + Date.now() + '.' + ext;
            const filePath = 'avatars/' + fileName;

            const { error: uploadErr } = await sb.storage.from(AVATAR_BUCKET).upload(filePath, file, { cacheControl: '3600', upsert: true });
            if (uploadErr) {
                const msg = (uploadErr.message || '').toLowerCase();
                if (msg.indexOf('bucket') !== -1 || msg.indexOf('not found') !== -1) {
                    showAvatarError('Storage bucket not set up yet. See the SUPABASE SETUP note in account-auth.js.');
                } else {
                    showAvatarError('Upload failed: ' + (uploadErr.message || 'unknown error'));
                }
                return;
            }

            const { data: urlData } = sb.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
            const publicUrl = urlData && urlData.publicUrl;
            if (!publicUrl) {
                showAvatarError('Could not resolve image URL after upload.');
                return;
            }

            // Best-effort DB sync. If the user_profiles table does not yet have
            // an avatar_url column, the update throws — we fall back to the
            // localStorage mirror (still works for the header icon).
            try {
                await sb.from('user_profiles').update({ avatar_url: publicUrl, updated_at: new Date().toISOString() }).eq('id', u.id);
                u.avatar_url = publicUrl;
            } catch (dbErr) {
                const m = (dbErr && dbErr.message) || '';
                if (/column/i.test(m)) {
                    console.info('user_profiles.avatar_url column not present; using localStorage mirror only.');
                } else {
                    console.warn('Could not persist avatar_url to DB.', dbErr);
                }
                u.avatar_url = publicUrl;
            }

            // Always mirror to localStorage so the header icon keeps working
            // across reloads and regardless of DB schema.
            localStorage.setItem('jmpotters_avatar', publicUrl);
            persistUser(u);

            notify('Profile picture updated!', 'success');
            renderAccountIcon();
            // If panel is open, refresh it.
            if (accountPanelOpen) renderAccountPanel();
            // Notify the dedicated account.html page if it's open in another tab.
            try {
                window.dispatchEvent(new CustomEvent('jmpotters:avatar-updated', { detail: { url: publicUrl } }));
            } catch (_) {}
        } catch (err) {
            console.error('Avatar upload error:', err);
            showAvatarError('Upload failed: ' + (err.message || 'unknown error'));
        }
    }

    async function removeAvatar() {
        const u = getCurrentUser();
        if (!u) return;

        const sb = getSupabase();
        if (sb) {
            try {
                await sb.from('user_profiles').update({ avatar_url: null, updated_at: new Date().toISOString() }).eq('id', u.id);
            } catch (_) {}
        }

        delete u.avatar_url;
        persistUser(u);
        localStorage.removeItem('jmpotters_avatar');

        notify('Profile picture removed', 'info');
        renderAccountIcon();
        if (accountPanelOpen) renderAccountPanel();
        try {
            window.dispatchEvent(new CustomEvent('jmpotters:avatar-updated', { detail: { url: null } }));
        } catch (_) {}
    }

    // ===========================================
    // Sign out
    // ===========================================
    function signOut() {
        localStorage.removeItem('jmpotters_user');
        sessionStorage.removeItem('jmpotters_user');
        localStorage.removeItem('jmpotters_avatar');
        closeAccountPanel();
        notify('Signed out successfully', 'info');
        // If the user is on account.html, send them home; otherwise reload.
        setTimeout(function() {
            const onAccountPage = window.location.pathname.toLowerCase().indexOf('account.html') !== -1;
            window.location.href = onAccountPage ? 'index.html' : window.location.href;
        }, 600);
    }

    // ===========================================
    // Hook for nav-search updates: if jmpotters_user changes (sign-in elsewhere),
    // account-auth.js reruns on next page load — but cross-tab changes need a
    // listener. Listen for storage events from other windows.
    // ===========================================
    function attachCrossTabSync() {
        if (window._jmpottersAccountStorageHook) return;
        window._jmpottersAccountStorageHook = true;
        window.addEventListener('storage', function(e) {
            if (!e.key) return;
            if (e.key === 'jmpotters_user' || e.key === 'jmpotters_avatar' || e.key === 'jmpotters_avatar_temp') {
                renderAccountIcon();
                if (accountPanelOpen) renderAccountPanel();
            }
        });
    }

    // ===========================================
    // Boot
    // ===========================================
    function init() {
        try {
            ensureAccountIcon();
            attachCrossTabSync();
        } catch (e) {
            console.error('JMPOTTERS account init error:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public surface for account.html and any debugging.
    window.JMPOTTERS_ACCOUNT = {
        SUPABASE_URL: SUPABASE_URL,
        SUPABASE_KEY: SUPABASE_KEY,
        AVATAR_BUCKET: AVATAR_BUCKET,
        MAX_AVATAR_BYTES: MAX_AVATAR_BYTES,
        ALLOWED_AVATAR_TYPES: ALLOWED_AVATAR_TYPES,
        getCurrentUser: getCurrentUser,
        getCurrentAvatar: getCurrentAvatar,
        persistUser: persistUser,
        renderAccountIcon: renderAccountIcon,
        renderAccountPanel: renderAccountPanel,
        openAccountPanel: openAccountPanel,
        closeAccountPanel: closeAccountPanel,
        uploadAvatar: uploadAvatar,
        removeAvatar: removeAvatar,
        handleAvatarFile: handleAvatarFile,
        signOut: signOut,
        notify: notify
    };
})();
