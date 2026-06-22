/**
 * C1991 — Blog Engine
 * Client-side Markdown rendering with cover images, tag filtering,
 * photo posts, and inline image lightbox support.
 * Dependencies: marked.js (loaded via CDN in blog.html)
 */

const Blog = (() => {
  'use strict';

  const BASE_PATH = '/posts/';
  const IMG_BASE = '/posts/images/';

  let manifest = [];
  let currentTag = null;

  // ============================================================
  // Init
  // ============================================================
  async function init() {
    try {
      const res = await fetch('/posts/manifest.json');
      if (!res.ok) throw new Error('manifest not found');
      manifest = await res.json();
      manifest.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (e) {
      console.warn('Blog: failed to load manifest', e);
      manifest = [];
    }
  }

  // ============================================================
  // Collect all unique tags from manifest
  // ============================================================
  function getAllTags() {
    const tags = new Set();
    manifest.forEach(p => (p.tags || []).forEach(t => tags.add(t)));
    return [...tags].sort();
  }

  // ============================================================
  // Render chapter-style list (novel TOC)
  // Supports ?tag=xxx filtering
  // ============================================================
  function renderList(targetId) {
    const el = document.getElementById(targetId);
    if (!el) return;

    const tagParam = new URLSearchParams(location.search).get('tag');
    let posts = manifest;
    if (tagParam) {
      posts = manifest.filter(p => (p.tags || []).includes(tagParam));
    }

    if (!manifest.length) {
      el.innerHTML = '<div class="empty-state">还没有文章，静待花开</div>';
      return;
    }

    if (tagParam && !posts.length) {
      el.innerHTML = `<div class="empty-state">还没有「${tagParam}」标签的文章</div>`;
      return;
    }

    const label = tagParam ? `「${tagParam}」· ${posts.length} 篇` : `目录 · ${posts.length} 篇`;
    const items = posts.map((post, i) => _chapterRow(post, i + 1)).join('');

    el.innerHTML = `
      <div class="chapter-section-label">${label}</div>
      <div class="chapter-list">${items}</div>
    `;
  }

  // ============================================================
  // Single chapter row (novel TOC style)
  // ============================================================
  function _chapterRow(post, num) {
    const date = _fmtDate(post.date);
    const title = _esc(post.title);
    const href = `/blog.html?post=${encodeURIComponent(post.slug)}`;

    return `
      <a href="${href}" class="chapter-item">
        <span class="chapter-num">${String(num).padStart(2, '0')}</span>
        <span class="chapter-title">${title}</span>
        <span class="chapter-date">${date}</span>
      </a>`;
  }

  // ============================================================
  // Render recent posts (homepage)
  // ============================================================
  function renderRecent(targetId, count = 5) {
    const el = document.getElementById(targetId);
    if (!el) return;

    const recent = manifest.slice(0, count);
    if (!recent.length) {
      el.innerHTML = '<div class="empty-state">还没有文章，静待花开</div>';
      return;
    }

    el.innerHTML = recent.map(post => _postCard(post)).join('');
  }

  // ============================================================
  // Render single post detail
  // ============================================================
  async function renderPost(targetId) {
    const slug = new URLSearchParams(location.search).get('post');
    const el = document.getElementById(targetId);
    if (!el) return;

    if (!slug) {
      el.innerHTML = '<div class="empty-state">请选择一篇文章阅读</div>';
      return;
    }

    const post = manifest.find(p => p.slug === slug);
    if (!post) {
      el.innerHTML = '<div class="empty-state">文章未找到</div>';
      return;
    }

    try {
      const res = await fetch(`${BASE_PATH}${slug}.md`);
      if (!res.ok) throw new Error('post not found');
      const md = await res.text();

      // Parse front-matter
      let content = md;
      let title = post.title;
      let date = post.date;
      let tags = post.tags || [];
      let coverImage = post.coverImage || null;

      if (md.startsWith('---')) {
        const end = md.indexOf('---', 3);
        if (end > 0) {
          const fm = md.slice(3, end).trim();
          content = md.slice(end + 3).trim();
          fm.split('\n').forEach(line => {
            const idx = line.indexOf(':');
            if (idx > 0) {
              const key = line.slice(0, idx).trim().toLowerCase();
              const val = line.slice(idx + 1).trim();
              if (key === 'title') title = val;
              if (key === 'date') date = val;
              if (key === 'tags') tags = val.split(',').map(t => t.trim());
              if (key === 'coverimage' || key === 'cover_image') coverImage = val;
            }
          });
        }
      }

      document.title = `${title} — C1991`;

      const html = typeof marked !== 'undefined'
        ? marked.parse(content)
        : `<pre>${_esc(content)}</pre>`;

      // Cover image (wrapped for watermark)
      const coverHtml = coverImage
        ? `<span class="img-watermark cover-img-wrap"><img src="${coverImage.startsWith('http') ? coverImage : IMG_BASE + coverImage}" alt="${_esc(title)}" class="cover-image" onerror="this.parentElement.style.display='none'"></span>`
        : '';

      el.innerHTML = `
        <div class="post-detail">
          ${coverHtml}
          <header>
            <h1>${_esc(title)}</h1>
            <div class="meta">
              ${_fmtDate(date)}
              ${tags.length ? '· ' + tags.map(t => `<span class="tag">${_esc(t)}</span>`).join(' ') : ''}
            </div>
          </header>
          <div class="content">${html}</div>
          <div class="post-footer">
            <div class="author-avatar"><img src="/images/icon.png" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>
            <div class="author-info">
              <div class="name">Jack Yang</div>
              <div class="desc">写于 ${_fmtDate(date)} · C1991</div>
            </div>
          </div>
        </div>
      `;

      // Wrap content images with watermark containers
      _wrapImagesWithWatermark(el);

      // Bind inline image lightbox (must come after wrapping)
      _initImageLightbox(el);

    } catch (e) {
      el.innerHTML = '<div class="empty-state">文章加载失败，请稍后再试</div>';
      console.error('Blog: failed to load post', e);
    }
  }

  // ============================================================
  // Inline image lightbox
  // ============================================================
  function _initImageLightbox(container) {
    // Create lightbox if not exists
    let lb = document.querySelector('.content-lightbox');
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'lightbox content-lightbox';
      lb.innerHTML = `
        <button class="close" aria-label="关闭">&times;</button>
        <span class="img-watermark"><img src="" alt=""></span>
      `;
      document.body.appendChild(lb);

      const close = lb.querySelector('.close');
      const img = lb.querySelector('img');

      close.addEventListener('click', () => lb.classList.remove('open'));
      lb.addEventListener('click', e => { if (e.target === lb) lb.classList.remove('open'); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') lb.classList.remove('open'); });
    }

    const lbImg = lb.querySelector('img');
    container.querySelectorAll('.content img').forEach(img => {
      img.addEventListener('click', () => {
        lbImg.src = img.src;
        lbImg.alt = img.alt || '';
        lb.classList.add('open');
      });
    });

    // Bind cover image click
    const coverImg = container.querySelector('.cover-image');
    if (coverImg) {
      coverImg.addEventListener('click', () => {
        lbImg.src = coverImg.src;
        lbImg.alt = coverImg.alt || '';
        lb.classList.add('open');
      });
    }
  }

  // ============================================================
  // Wrap content images with watermark containers
  // ============================================================
  function _wrapImagesWithWatermark(container) {
    container.querySelectorAll('.content img').forEach(img => {
      // Skip if already wrapped (idempotent)
      if (img.parentElement && img.parentElement.classList.contains('img-watermark')) return;
      const wrapper = document.createElement('span');
      wrapper.className = 'img-watermark';
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
    });
  }

  // ============================================================
  // Helpers
  // ============================================================
  function _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function _fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  // ============================================================
  // Public API
  // ============================================================
  return {
    get manifest() { return manifest; },
    init,
    renderList,
    renderRecent,
    renderPost,
  };
})();
