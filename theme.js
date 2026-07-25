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
})();
