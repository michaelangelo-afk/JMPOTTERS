/* =========================================================
   JMPOTTERS — shared theme toggle script
   Pairs with /theme.css. Apply on every storefront page:
     <head> inline FOUC script (sets class early)
     <body> <script src="theme.js" defer></script>
   ========================================================= */
(function(){
  'use strict';
  var KEY = 'jmpTheme';
  var root = document.documentElement;

  function isDark(){
    return root.classList.contains('dark-mode');
  }

  function applyTheme(t){
    try { if(t === 'dark') root.classList.add('dark-mode'); else root.classList.remove('dark-mode'); } catch(e){}
  }

  // Sync state from localStorage (FOUC in <head> already set it, but keep window in sync)
  try { applyTheme(localStorage.getItem(KEY)); } catch(e){}

  // Expose a global toggle for any existing UI that wants to call it
  window.toggleJmpTheme = function(){
    var next = isDark() ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(KEY, next); } catch(e){}
    syncButton();
    return next;
  };

  function makeButtonSvg(className, paths){
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', className);
    svg.setAttribute('width','18'); svg.setAttribute('height','18');
    svg.setAttribute('viewBox','0 0 24 24'); svg.setAttribute('fill','none');
    svg.setAttribute('stroke','currentColor'); svg.setAttribute('stroke-width','2');
    svg.setAttribute('stroke-linecap','round'); svg.setAttribute('stroke-linejoin','round');
    paths.forEach(function(d){
      var p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); svg.appendChild(p);
    });
    return svg;
  }

  function buildButton(){
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'theme-toggle-btn';
    btn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('title', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
    btn.addEventListener('click', function(e){
      e.preventDefault();
      window.toggleJmpTheme();
    });

    // Moon icon (visible in light mode — clicking switches to dark)
    var moonPaths = [
      'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z'
    ];
    btn.appendChild(makeButtonSvg('moon-icon', moonPaths));

    // Sun icon (visible in dark mode — clicking switches to light)
    var sunPaths = [
      'M12 1v2',         // top spoke
      'M12 21v2',        // bottom spoke
      'M4.22 4.22l1.42 1.42', // top-left
      'M18.36 18.36l1.42 1.42', // bottom-right
      'M1 12h2',
      'M21 12h2',
      'M4.22 19.78l1.42-1.42',
      'M18.36 5.64l1.42-1.42'
    ];
    var sunCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    sunCircle.setAttribute('cx','12'); sunCircle.setAttribute('cy','12'); sunCircle.setAttribute('r','5');
    var sunSvg = makeButtonSvg('sun-icon', []);
    sunSvg.appendChild(sunCircle);
    sunPaths.forEach(function(d){
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d); sunSvg.appendChild(p);
    });
    btn.appendChild(sunSvg);

    return btn;
  }

  function syncButton(){
    var btn = document.querySelector('.theme-toggle-btn');
    if(!btn) return;
    if(isDark()){
      btn.classList.add('dark-mode');
      btn.setAttribute('aria-label','Switch to light mode');
      btn.setAttribute('title','Switch to light mode');
    } else {
      btn.classList.remove('dark-mode');
      btn.setAttribute('aria-label','Switch to dark mode');
      btn.setAttribute('title','Switch to dark mode');
    }
  }

  function maybeInject(){
    if(document.querySelector('.theme-toggle-btn')) { syncButton(); return; }
    try { document.body.appendChild(buildButton()); } catch(e){}
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', maybeInject);
  } else {
    maybeInject();
  }

  // Cross-tab sync: if user toggled theme in another tab, mirror it
  try {
    window.addEventListener('storage', function(ev){
      if(ev.key === KEY) { applyTheme(ev.newValue); syncButton(); }
    });
  } catch(e){}

  // ===== Migrate legacy invoiceDarkMode key from older invoice.html implementation =====
  try {
    if (localStorage.getItem('jmpTheme') === null && localStorage.getItem('invoiceDarkMode') !== null) {
      localStorage.setItem('jmpTheme', localStorage.getItem('invoiceDarkMode') === 'true' ? 'dark' : 'light');
      localStorage.removeItem('invoiceDarkMode');
    }
  } catch(e){}

  // ===== Screen-reader live-region announcer (a11y for copy buttons, toasts) =====
  function ensureLiveRegion(){
    var existing = document.getElementById('jmp-sr-announce');
    if (existing) return existing;
    var div = document.createElement('div');
    div.id = 'jmp-sr-announce';
    div.className = 'sr-only';
    div.setAttribute('role', 'status');
    div.setAttribute('aria-live', 'polite');
    div.setAttribute('aria-atomic', 'true');
    document.body.appendChild(div);
    return div;
  }
  window.jmpAnnounce = function(text){
    try {
      var region = ensureLiveRegion();
      region.textContent = '';
      setTimeout(function(){ region.textContent = String(text || ''); }, 60);
    } catch(e){}
  };

  // ===== Theme toggle announcement (a11y) =====
  var _origToggle = window.toggleJmpTheme;
  window.toggleJmpTheme = function(){
    var next = _origToggle ? _origToggle() : (document.documentElement.classList.contains('dark-mode') ? 'light' : 'dark');
    try { window.jmpAnnounce && window.jmpAnnounce('Theme switched to ' + next + ' mode.'); } catch(e){}
    return next;
  };

  // ===== Shared copy-to-clipboard helper (HARDENED V2) =====
  // Real success-aware: if both modern + legacy paths fail, does NOT fake
  // a 'Copied' state — instead adds a .copy-failed class for visual feedback
  // (CSS in theme.css) and announces failure via screen reader + toast.
  // Per-button setTimeout token (_copyRevertTimer) cancels any in-flight
  // revert so rapid double-clicks cannot prematurely wipe the success/fail
  // class out from under us.
  window.copyBankNumber = function(num, btn){
    var t = String(num);
    btn = btn || null;
    var liveRegion = (function(){
      var existing = document.getElementById('jmp-sr-announce');
      if (existing) return existing;
      var d = document.createElement('div');
      d.id = 'jmp-sr-announce';
      d.className = 'sr-only';
      d.setAttribute('role','status');
      d.setAttribute('aria-live','polite');
      d.setAttribute('aria-atomic','true');
      document.body.appendChild(d);
      return d;
    })();
    function announce(msg){ try { liveRegion.textContent = ''; setTimeout(function(){ liveRegion.textContent = msg; }, 50); } catch(e){} }
    function showToastSafe(msg, type){
      try { showToast && showToast(msg, type); } catch(e){}
    }
    // Per-button state-revert scheduler. Cancels any in-flight revert before
    // setting a new one, and runs `onRevert(className)` so any
    // swap-specific reverting (animation timeline, focus, etc) can be done
    // atomically with the class removal. No more decoupled innerHTML-revert
    // timer that races rapid double-clicks.
    // Per-button state-revert scheduler. Cancels any in-flight revert before
    // setting a new one. Class removal runs in the same tick so addEventListener
    // targets on the button stay intact across rapid double-clicks.
    function scheduleRevert(cls, btnRef, ms){
      if (!btnRef) return;
      try {
        if (btnRef._copyRevertTimer) clearTimeout(btnRef._copyRevertTimer);
      } catch(_e){}
      btnRef._copyRevertTimer = setTimeout(function(){
        try {
          if (btnRef && btnRef.classList) btnRef.classList.remove(cls);
        } catch(_e){}
        btnRef._copyRevertTimer = null;
      }, ms);
    }
    // Pure class toggle — UI swap is handled entirely by CSS via sibling
    // .copy-state / .copied-state / .copy-failed-state spans. No innerHTML
    // rewriting, so addEventListener-bound targets stay intact across
    // rapid double-clicks. Strip the opposite state class first so a
    // copy->fail interleave cannot render both spans simultaneously on
    // the same button.
    function markCopied(){
      if (!btn) return;
      try {
        if (btn.classList.contains('copy-failed')) btn.classList.remove('copy-failed');
        btn.classList.add('copied');
      } catch(_e){}
      scheduleRevert('copied', btn, 1800);
    }
    // Pure class toggle — sister of markCopied. CSS swaps the .copy-state
    // span for the .copy-failed-state span (Checkout buttons got a
    // .copy-failed-state sibling added in the same pass).
    function markFailed(){
      if (!btn) return;
      try {
        if (btn.classList.contains('copied')) btn.classList.remove('copied');
        btn.classList.add('copy-failed');
      } catch(_e){}
      scheduleRevert('copy-failed', btn, 1800);
    }
    function ok(){
      announce('Account number copied: ' + t);
      showToastSafe('Account number copied: ' + t, 'success');
      markCopied();
    }
    function fail(reason){
      announce(reason || 'Copy failed. Please select the number and copy manually.');
      showToastSafe(reason || 'Copy failed. Please copy manually.', 'error');
      markFailed();
    }
    function legacyCopy(){
      try {
        var ta = document.createElement('textarea');
        ta.value = t; ta.setAttribute('readonly','');
        ta.style.position='fixed'; ta.style.top='-9999px'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select();
        var worked = false;
        try { worked = document.execCommand && document.execCommand('copy') === true; } catch(e){ worked = false; }
        document.body.removeChild(ta);
        return worked === true;
      } catch(_e){ return false; }
    }
    function modern(){
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') return Promise.resolve(false);
      // Skip the modern API on insecure (HTTP) origins — the call would silently fail.
      if (window.isSecureContext === false) return Promise.resolve(false);
      return navigator.clipboard.writeText(t).then(function(){ return true; }).catch(function(){ return false; });
    }
    try {
      modern().then(function(okModern){
        if (okModern) { ok(); return; }
        if (legacyCopy()) { ok(); return; }
        fail('Copy failed. Both clipboard APIs blocked. Please copy manually.');
      }).catch(function(){
        if (legacyCopy()) { ok(); return; }
        fail('Copy failed. Both clipboard APIs blocked. Please copy manually.');
      });
    } catch(_e){
      if (legacyCopy()) { ok(); return; }
      fail('Copy failed. Both clipboard APIs blocked. Please copy manually.');
    }
  };
})();
