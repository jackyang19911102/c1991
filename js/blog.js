// C1991 — Blog Engine (Client-side Markdown rendering)
// Dependencies: marked.js (loaded via CDN in blog.html)

const Blog = {
  manifest: [],
  basePath: '/posts/',

  async init() {
    try {
      const res = await fetch('/posts/manifest.json');
      if (!res.ok) throw new Error('manifest not found');
      this.manifest = await res.json();
      // Sort by date descending
      this.manifest.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (e) {
      console.warn('Blog: failed to load manifest', e);
      this.manifest = [];
    }
  },

  // Render article list for blog.html
  async renderList(targetId) {
    await this.init();
    const el = document.getElementById(targetId);
    if (!el) return;

    if (!this.manifest.length) {
      el.innerHTML = '<div class="empty-state">还没有文章，静待花开 🌱</div>';
      return;
    }

    el.innerHTML = this.manifest.map(post => `
      <a href="/blog.html?post=${encodeURIComponent(post.slug)}" class="post-card">
        <div class="date">${this._fmtDate(post.date)}</div>
        <div class="post-title">${this._esc(post.title)}</div>
        <div class="excerpt">${this._esc(post.excerpt || '')}</div>
        ${post.tags ? `<div class="tags">${post.tags.map(t => `<span class="tag">${this._esc(t)}</span>`).join('')}</div>` : ''}
      </a>
    `).join('');
  },

  // Render recent posts for home page
  async renderRecent(targetId, count = 5) {
    await this.init();
    const el = document.getElementById(targetId);
    if (!el) return;

    const recent = this.manifest.slice(0, count);
    if (!recent.length) {
      el.innerHTML = '<div class="empty-state">还没有文章，静待花开 🌱</div>';
      return;
    }

    el.innerHTML = recent.map(post => `
      <a href="/blog.html?post=${encodeURIComponent(post.slug)}" class="post-card">
        <div class="date">${this._fmtDate(post.date)}</div>
        <div class="post-title">${this._esc(post.title)}</div>
        <div class="excerpt">${this._esc(post.excerpt || '')}</div>
        ${post.tags ? `<div class="tags">${post.tags.map(t => `<span class="tag">${this._esc(t)}</span>`).join('')}</div>` : ''}
      </a>
    `).join('');
  },

  // Render single post detail
  async renderPost(targetId) {
    await this.init();
    const slug = new URLSearchParams(location.search).get('post');
    const el = document.getElementById(targetId);
    if (!el) return;

    if (!slug) {
      el.innerHTML = '<div class="empty-state">请选择一篇文章阅读</div>';
      return;
    }

    const post = this.manifest.find(p => p.slug === slug);
    if (!post) {
      el.innerHTML = '<div class="empty-state">文章未找到</div>';
      return;
    }

    try {
      const res = await fetch(`${this.basePath}${slug}.md`);
      if (!res.ok) throw new Error('post not found');
      const md = await res.text();

      // Parse front-matter if present (simple --- delimiter)
      let content = md;
      let title = post.title;
      let date = post.date;
      let tags = post.tags || [];

      if (md.startsWith('---')) {
        const end = md.indexOf('---', 3);
        if (end > 0) {
          const fm = md.slice(3, end).trim();
          content = md.slice(end + 3).trim();
          // Parse simple key: value front-matter
          fm.split('\n').forEach(line => {
            const idx = line.indexOf(':');
            if (idx > 0) {
              const key = line.slice(0, idx).trim().toLowerCase();
              const val = line.slice(idx + 1).trim();
              if (key === 'title') title = val;
              if (key === 'date') date = val;
              if (key === 'tags') tags = val.split(',').map(t => t.trim());
            }
          });
        }
      }

      document.title = `${title} — C1991`;

      const html = typeof marked !== 'undefined'
        ? marked.parse(content)
        : `<pre>${this._esc(content)}</pre>`;

      el.innerHTML = `
        <div class="post-detail">
          <header>
            <h1>${this._esc(title)}</h1>
            <div class="meta">${this._fmtDate(date)}${tags.length ? ' · ' + tags.map(t => `<span class="tag">${this._esc(t)}</span>`).join(' ') : ''}</div>
          </header>
          <div class="content">${html}</div>
        </div>
      `;
    } catch (e) {
      el.innerHTML = '<div class="empty-state">文章加载失败，请稍后再试</div>';
      console.error('Blog: failed to load post', e);
    }
  },

  _esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  },

  _fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  }
};
