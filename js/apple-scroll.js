/**
 * C1991 — Apple-Style Scroll Animation Engine
 * Scale+fade reveal on scroll, frosted nav darkening,
 * smooth anchor scrolling with offset.
 */

const AppleScroll = (() => {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ============================================================
  // Scroll Reveal — Apple scale(0.92)→1 + translateY(30)→0 + fade
  // ============================================================
  function initReveal(selector = '.apple-reveal') {
    if (prefersReduced) {
      document.querySelectorAll(selector).forEach(el => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: '0px 0px -30px 0px',
      }
    );

    document.querySelectorAll(selector).forEach(el => observer.observe(el));
  }

  // ============================================================
  // Nav scroll — adds .scrolled class after scroll
  // ============================================================
  function initNavScroll(selector = '.nav', threshold = 10) {
    if (prefersReduced) {
      const nav = document.querySelector(selector);
      if (nav) nav.classList.add('scrolled');
      return;
    }

    const nav = document.querySelector(selector);
    if (!nav) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          nav.classList.toggle('scrolled', window.scrollY > threshold);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ============================================================
  // Smooth scroll to anchor with nav offset
  // ============================================================
  function initAnchorScroll(navSelector = '.nav') {
    const nav = document.querySelector(navSelector);
    const offset = nav ? nav.offsetHeight + 10 : 60;

    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', function(e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;

        const target = document.querySelector(targetId);
        if (!target) return;

        e.preventDefault();

        const top = target.getBoundingClientRect().top + window.scrollY - offset;

        window.scrollTo({
          top,
          behavior: prefersReduced ? 'auto' : 'smooth',
        });
      });
    });
  }

  // ============================================================
  // Highlight nav link for current visible section
  // ============================================================
  function initNavHighlight(navLinkSelector = '.nav-links a') {
    if (prefersReduced) return;

    const links = document.querySelectorAll(navLinkSelector);
    if (!links.length) return;

    // Only for pages with hash-anchored nav (index with #sections)
    const hasHashLinks = [...links].some(l => l.getAttribute('href')?.startsWith('#'));
    if (!hasHashLinks) return;

    const sections = [...links]
      .map(l => document.querySelector(l.getAttribute('href')))
      .filter(Boolean);

    if (!sections.length) return;

    let ticking = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!ticking) {
          requestAnimationFrame(() => {
            // Find the first visible section
            const visible = entries
              .filter(e => e.isIntersecting)
              .sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top);

            if (visible.length) {
              const currentId = '#' + visible[0].target.id;
              links.forEach(l => {
                l.classList.toggle('active', l.getAttribute('href') === currentId);
              });
            }
            ticking = false;
          });
          ticking = true;
        }
      },
      { threshold: 0.4 }
    );

    sections.forEach(s => observer.observe(s));
  }

  // ============================================================
  // Page load staggered entrance
  // ============================================================
  function initPageLoad(selector = '.apple-reveal-on-load') {
    if (prefersReduced) {
      document.querySelectorAll(selector).forEach(el => el.classList.add('visible'));
      return;
    }

    const els = document.querySelectorAll(selector);
    els.forEach((el, i) => {
      el.style.transitionDelay = `${i * 0.07}s`;
      // Trigger after a frame for the CSS transition to apply
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.add('visible');
        });
      });
    });
  }

  return {
    initReveal,
    initNavScroll,
    initAnchorScroll,
    initNavHighlight,
    initPageLoad,
  };
})();
