// Motion layer: smooth scroll, header state, reveals and small interactions.
// Everything degrades to the static page when GSAP is missing, the visitor prefers
// reduced motion, or the URL carries ?static (used for full-page screenshots).
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var forceStatic = /[?&]static\b/.test(location.search);
  var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger, SplitText = window.SplitText;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  // ---------- Header: dark over the navy page head, light afterwards ----------
  var header = $('.site-header');
  var head = $('.intro, .hero, .page-head');
  var bar = document.createElement('span');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  if (header) header.appendChild(bar);
  function headerState() {
    if (!header) return;
    var y = window.scrollY;
    var limit = head ? head.getBoundingClientRect().bottom + y - header.offsetHeight : 0;
    header.classList.toggle('is-dark', !!head && y < limit - 1);
    header.classList.toggle('is-raised', y > 8);
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
  }
  headerState();
  window.addEventListener('scroll', headerState, { passive: true });
  window.addEventListener('resize', headerState);

  // Cursor glow on content blocks works without GSAP
  if (fine) {
    $$('.position, .contact, .labs > *, .qualification, .callout').forEach(function (el) {
      el.classList.add('glow');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left + 12) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top + 12) + 'px');
      });
    });
  }

  if (!gsap || !ScrollTrigger || reduce || forceStatic) return;
  root.classList.add('motion');
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  if (SplitText) gsap.registerPlugin(SplitText);

  // ---------- Smooth scroll ----------
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
    window.__lenis = lenis;
    if (window.__loader) {
      lenis.stop();
      window.__loader.ready.then(function () { lenis.start(); ScrollTrigger.refresh(); });
    }
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href*="#"]');
      if (!a || a.target === '_blank') return;
      var url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash || url.hash === '#main') return;
      var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -96, duration: 1.2 });
      history.pushState(null, '', url.hash);
    });
  }

  // ---------- Opening titles ----------
  function splitLines(el) {
    return SplitText ? SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line' }).lines : [el];
  }
  var fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
  var introReady = window.__loader ? window.__loader.ready : Promise.resolve();
  fontsReady.then(function () {
    var title = $('.intro h1, .hero h1, .page-head h1');
    if (title) {
      var lines = splitLines(title);
      var rest = $$('.hero-org, .intro .sub, .intro .actions, .page-head p, .page-head .jump, .chapters, .intro-cue');
      gsap.set(lines, { yPercent: 110 });
      gsap.set(rest, { opacity: 0, y: 24 });
      introReady.then(function () {
        gsap.to(lines, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: 0.1, delay: 0.1 });
        gsap.to(rest, { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: 0.08, delay: 0.35 });
      });
    }

    // Section headings rise out of masked lines as they enter
    $$('main h2').forEach(function (h) {
      if (h.closest('.intro, .page-head, [role="tabpanel"], .tabpanel')) return;
      gsap.from(splitLines(h), {
        yPercent: 110, duration: 1.15, ease: 'expo.out', stagger: 0.1,
        scrollTrigger: { trigger: h, start: 'top 88%', once: true }
      });
    });

    // Vision statement lights up word by word, tied to scroll
    $$('[data-words]').forEach(function (p) {
      var words = SplitText ? SplitText.create(p, { type: 'words', wordsClass: 'w' }).words : [];
      if (!words.length) return;
      gsap.fromTo(words, { opacity: 0.16 }, {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: p, start: 'top 82%', end: 'bottom 52%', scrub: true }
      });
    });
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  });

  // ---------- Staggered reveals ----------
  var revealSel = [
    '.lede', '.rows > *', '.index a', '.person', '.partners img', '.split .more', '.stats li',
    '.engine li', '.prose-blocks > *', '.contact', '.position', '.qualification', '.program > *:not(h2)',
    '.labs > *', '.table-wrap', '.desirable > *', '.cta-band .wrap > *', '.areas li', '.links li', '.notes', '.callout'
  ].join(',');
  var fades = $$(revealSel).filter(function (el) {
    return !el.closest('.intro, .page-head, [role="tabpanel"], .tabpanel, .local-index');
  });
  gsap.set(fades, { opacity: 0, y: 34 });
  ScrollTrigger.batch(fades, {
    start: 'top 90%', once: true,
    onEnter: function (els) {
      gsap.to(els, { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.07, overwrite: true });
    }
  });

  // ---------- Counters ----------
  $$('[data-count]').forEach(function (el) {
    var n = parseInt(el.getAttribute('data-count'), 10), o = { v: 0 };
    el.textContent = '0';
    ScrollTrigger.create({
      trigger: el, start: 'top 90%', once: true,
      onEnter: function () {
        gsap.to(o, { v: n, duration: 1.8, ease: 'power2.out', onUpdate: function () { el.textContent = Math.round(o.v); } });
      }
    });
  });

  // ---------- Hover highlight that glides between items ----------
  if (fine) {
    $$('.rows, .index').forEach(function (list) {
      var hl = document.createElement('span');
      hl.className = 'hl';
      hl.setAttribute('aria-hidden', 'true');
      list.insertBefore(hl, list.firstChild);
      var shown = false;
      Array.prototype.forEach.call(list.children, function (item) {
        if (item === hl) return;
        item.addEventListener('pointerenter', function () {
          var pad = list.classList.contains('index') ? 0 : 18;
          var box = { x: item.offsetLeft - pad, y: item.offsetTop, width: item.offsetWidth + pad * 2, height: item.offsetHeight };
          if (shown) gsap.to(hl, Object.assign({ duration: 0.45, ease: 'power3.out' }, box));
          else gsap.set(hl, box);
          shown = true;
          hl.classList.add('on');
        });
      });
      list.addEventListener('pointerleave', function () { hl.classList.remove('on'); shown = false; });
    });

    // Portrait tilt
    $$('.person').forEach(function (card) {
      var img = $('img', card);
      if (!img) return;
      var rx = gsap.quickTo(img, 'rotationX', { duration: 0.6, ease: 'power3' });
      var ry = gsap.quickTo(img, 'rotationY', { duration: 0.6, ease: 'power3' });
      var sc = gsap.quickTo(img, 'scale', { duration: 0.6, ease: 'power3' });
      card.addEventListener('pointermove', function (e) {
        var r = img.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        rx(-py * 10); ry(px * 12); sc(1.03);
      });
      card.addEventListener('pointerleave', function () { rx(0); ry(0); sc(1); });
    });
  }

  // ---------- Gold pulses travelling along the page-head graph ----------
  var ROUTES = [[0, 1, 2, 4, 7, 9, 11, 12], [3, 4, 5, 6, 8, 10, 13], [0, 2, 3, 4, 7, 8, 12]];
  $$('.page-head .graph').forEach(function (svg) {
    var nodes = $$('circle.n', svg);
    if (nodes.length < 14) return;
    var firstNode = nodes[0], NS = 'http://www.w3.org/2000/svg';
    ROUTES.forEach(function (route, i) {
      var d = route.map(function (k, j) {
        return (j ? 'L' : 'M') + nodes[k].getAttribute('cx') + ' ' + nodes[k].getAttribute('cy');
      }).join(' ');
      ['beam-glow', 'beam'].forEach(function (cls) {
        var p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d);
        p.setAttribute('class', cls);
        p.setAttribute('pathLength', '1');
        svg.insertBefore(p, firstNode);
        gsap.fromTo(p, { strokeDashoffset: 0.07 }, {
          strokeDashoffset: -1, duration: 3.2, ease: 'power1.inOut', repeat: -1, repeatDelay: 1.4, delay: 0.8 + i * 1.5
        });
      });
    });
    if (fine) {
      var gx = gsap.quickTo(svg, 'x', { duration: 1.2, ease: 'power3' });
      var gy = gsap.quickTo(svg, 'y', { duration: 1.2, ease: 'power3' });
      svg.closest('.page-head').addEventListener('pointermove', function (e) {
        gx((e.clientX / window.innerWidth - 0.5) * -24);
        gy((e.clientY / window.innerHeight - 0.5) * -14);
      });
    }
  });

  // ---------- Innovation Engine: track fills, stages light, loop closes ----------
  $$('.engine').forEach(function (engine) {
    var steps = $$('li', engine);
    ScrollTrigger.create({
      trigger: engine, start: 'top 78%', end: 'bottom 62%', scrub: 0.6,
      onUpdate: function (self) {
        var fill = Math.min(1, self.progress / 0.8);
        var loop = Math.max(0, Math.min(1, (self.progress - 0.8) / 0.2));
        engine.style.setProperty('--fill', fill.toFixed(3));
        engine.style.setProperty('--loop', loop.toFixed(3));
        steps.forEach(function (li, i) { li.classList.toggle('lit', fill >= i / (steps.length - 1) - 0.001); });
      }
    });
  });

  // ---------- Partners and the footer settle in gently ----------
  window.addEventListener('load', function () { ScrollTrigger.sort(); ScrollTrigger.refresh(); });
})();
