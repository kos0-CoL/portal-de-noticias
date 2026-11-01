/* =========================================================================
   Saladillo Noticias — Maqueta estática de demostración
   app.js · Vanilla JS, sin frameworks.
   Contiene: navegación del panel, lectura por voz (Web Speech API),
   simulador de scraping, prueba de conexión de IA y "Copiar enlace".
   Cada bloque detecta si el elemento existe, así el mismo archivo sirve
   para index.html, nota.html y admin.html.
   ========================================================================= */
(function () {
  'use strict';

  /* -------------------------------------------------- fallback de imágenes */
  // (también se define inline en el <head> para que esté disponible antes
  //  de que el navegador intente cargar las imágenes)
  window.imgFail = function (el) {
    el.onerror = null;
    el.classList.add('img-fallback');
    el.src =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='12'%3E%3Crect width='16' height='12' fill='%23E8EAEE'/%3E%3C/svg%3E";
  };

  /* =========================================================== LECTURA POR VOZ */
  var synth = window.speechSynthesis;
  var currentBtn = null;

  function resetSpeakBtn(btn) {
    if (!btn) return;
    btn.dataset.playing = '0';
    btn.classList.remove('is-playing');
    if (btn.dataset.originalLabel) btn.innerHTML = btn.dataset.originalLabel;
  }

  function speakTarget(btn) {
    var custom = btn.getAttribute('data-speak');
    if (custom && custom.trim()) return custom.trim();
    var node = document.querySelector(btn.getAttribute('data-speak-target') || '#article-body');
    if (node) {
      // se clona el nodo para no alterar el DOM y se excluye la publicidad
      var clone = node.cloneNode(true);
      clone.querySelectorAll('.no-print, figcaption, script').forEach(function (n) { n.remove(); });
      return clone.textContent.replace(/\s+/g, ' ').trim();
    }
    return document.title;
  }

  function onSpeakClick(e) {
    var btn = e.currentTarget;
    if (!synth) {
      alert('Tu navegador no soporta la lectura por voz.');
      return;
    }
    // si ya está leyendo este mismo botón -> detener
    if (btn.dataset.playing === '1') {
      synth.cancel();
      resetSpeakBtn(btn);
      if (currentBtn === btn) currentBtn = null;
      return;
    }
    // detener cualquier otra lectura en curso
    if (synth.speaking) synth.cancel();
    if (currentBtn && currentBtn !== btn) resetSpeakBtn(currentBtn);

    btn.dataset.originalLabel = btn.dataset.originalLabel || btn.innerHTML;
    btn.dataset.playing = '1';
    btn.classList.add('is-playing');
    btn.innerHTML = '⏹ Detener';
    currentBtn = btn;

    var u = new SpeechSynthesisUtterance(speakTarget(btn));
    u.lang = 'es-AR';
    u.rate = 1;
    u.pitch = 1;
    var done = function () {
      resetSpeakBtn(btn);
      if (currentBtn === btn) currentBtn = null;
    };
    u.onend = done;
    u.onerror = done;
    synth.speak(u);
  }

  document.querySelectorAll('[data-speak], [data-speak-btn]').forEach(function (btn) {
    btn.addEventListener('click', onSpeakClick);
  });

  window.addEventListener('beforeunload', function () {
    if (synth) synth.cancel();
  });

  /* ============================================================ COPIAR ENLACE */
  document.querySelectorAll('[data-copy-link]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-copy-link') || window.location.href;
      var label = btn.innerHTML;
      var ok = function () {
        btn.innerHTML = '✓ Enlace copiado';
        setTimeout(function () { btn.innerHTML = label; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(ok, function () { fallbackCopy(url, ok); });
      } else {
        fallbackCopy(url, ok);
      }
    });
  });

  function fallbackCopy(text, cb) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); cb(); } catch (err) { /* noop */ }
    document.body.removeChild(ta);
  }

  /* ================================================== NAVEGACIÓN DEL PANEL */
  var sideLinks = document.querySelectorAll('.admin-sidebar-link[data-section]');
  if (sideLinks.length) {
    var sections = document.querySelectorAll('.admin-section');
    var title = document.getElementById('admin-section-title');

    function showSection(id) {
      sections.forEach(function (s) {
        s.classList.toggle('hidden', s.getAttribute('data-section') !== id);
      });
      sideLinks.forEach(function (l) {
        l.classList.toggle('is-active', l.getAttribute('data-section') === id);
      });
      if (title) {
        var active = document.querySelector('.admin-sidebar-link[data-section="' + id + '"]');
        title.textContent = active ? active.getAttribute('data-title') || id : id;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    sideLinks.forEach(function (l) {
      l.addEventListener('click', function () {
        showSection(l.getAttribute('data-section'));
        closeMobileSidebar();
      });
    });

    // accesos rápidos de otras secciones: <button data-goto="noticias">
    document.querySelectorAll('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () { showSection(b.getAttribute('data-goto')); });
    });
  }

  /* ------------------------------------------------- sidebar mobile (admin) */
  var sidebar = document.getElementById('admin-sidebar');
  var overlay = document.getElementById('admin-overlay');
  function openMobileSidebar() {
    if (sidebar) sidebar.classList.remove('-translate-x-full');
    if (overlay) overlay.classList.remove('hidden');
  }
  function closeMobileSidebar() {
    if (sidebar) sidebar.classList.add('-translate-x-full');
    if (overlay) overlay.classList.add('hidden');
  }
  var burger = document.getElementById('admin-burger');
  if (burger) burger.addEventListener('click', openMobileSidebar);
  if (overlay) overlay.addEventListener('click', closeMobileSidebar);

  /* ==================================================== SIMULADOR DE SCRAPING */
  var runBtn = document.getElementById('run-scraping');
  if (runBtn) {
    var logBox = document.getElementById('scrape-log');
    var logBody = document.getElementById('scrape-log-lines');
    var spinner = document.getElementById('scrape-spinner');
    var stampEl = document.getElementById('scrape-stamp');

    var SCRIPT = [
      { t: '[09:41:00] Iniciando job de scraping · 2 fuentes activas…', c: '' },
      { t: '[09:41:02] ✓ Fuente: Diario Regional Zona Sur — 14 links encontrados', c: 'ok' },
      { t: '[09:41:04] ✓ Fuente: Portal Provincia de Buenos Aires — 6 links encontrados', c: 'ok' },
      { t: '[09:41:06] ✓ "Volcó un camión en la Ruta 51" → creada como borrador (prioridad ALTA por 2 palabras clave)', c: 'ok' },
      { t: '[09:41:07] ✓ Palabras clave locales detectadas: Saladillo, Polvaredas', c: 'ok' },
      { t: '[09:41:09] ! "Nuevo plan de obras en la provincia" — sin coincidencias locales (prioridad normal)', c: 'warn' },
      { t: '[09:41:11] ! 3 items omitidos por similitud con notas ya publicadas', c: 'warn' },
      { t: '[09:41:12] ✗ 1 item fallido (timeout al descargar imagen)', c: 'err' },
      { t: '[09:41:12] ✓ Job finalizado: 14 encontrados · 9 creados · 4 omitidos · 1 fallido', c: 'ok' }
    ];

    var running = false;

    function pad(n) { return (n < 10 ? '0' : '') + n; }

    function run() {
      if (running) return;
      running = true;
      runBtn.disabled = true;
      runBtn.innerHTML = '<span class="spinner"></span> Ejecutando scraping…';
      if (logBody) logBody.innerHTML = '';
      if (logBox) logBox.classList.add('hidden');

      setTimeout(function () {
        if (logBox) logBox.classList.remove('hidden');
        var i = 0;
        var realStart = new Date();
        (function next() {
          if (i >= SCRIPT.length) {
            running = false;
            runBtn.disabled = false;
            runBtn.innerHTML = '▶ Ejecutar scraping ahora';
            if (stampEl) {
              var d = new Date();
              stampEl.textContent = 'Última ejecución: hoy a las ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
            }
            return;
          }
          var line = SCRIPT[i++];
          // re-etiquetado con la hora real de la demo
          var now = new Date(realStart.getTime() + (i - 1) * 900);
          var text = line.t.replace(/^\[\d\d:\d\d:\d\d\]/, '[' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds()) + ']');
          var div = document.createElement('div');
          if (line.c) div.className = line.c;
          div.textContent = text;
          if (logBody) logBody.appendChild(div);
          if (logBox) logBox.scrollTop = logBox.scrollHeight;
          setTimeout(next, 260);
        })();
      }, 1500);
    }

    runBtn.addEventListener('click', run);
  }

  /* =============================================== PRUEBA DE CONEXIÓN DE IA */
  var aiBtn = document.getElementById('ai-test');
  if (aiBtn) {
    var aiResult = document.getElementById('ai-test-result');
    aiBtn.addEventListener('click', function () {
      if (aiResult) {
        aiResult.className = 'mt-3 text-sm font-semibold text-news-500';
        aiResult.textContent = 'Verificando conexión con el proveedor…';
      }
      aiBtn.disabled = true;
      aiBtn.textContent = 'Probando…';
      setTimeout(function () {
        aiBtn.disabled = false;
        aiBtn.textContent = 'Probar conexión';
        if (aiResult) {
          aiResult.className = 'mt-3 text-sm font-semibold text-emerald-700';
          aiResult.textContent = '✓ Conexión exitosa — gpt-4o-mini respondió en 780 ms';
        }
      }, 900);
    });
  }
})();
