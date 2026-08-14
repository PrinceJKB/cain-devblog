#!/usr/bin/env node
// Cain devblog — static site generator.
//
// Zero dependencies. No npm install, ever. This is deliberate: a devblog dies
// when its toolchain rots, so the only thing this needs is Node itself.
//
//   node build.mjs           build docs/
//   node build.mjs --serve   build, then serve docs/ on localhost:8080 and rebuild on request
//   node build.mjs --new "Some title"   scaffold a new post for today

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const POSTS_DIR = path.join(ROOT, 'posts');
const OUT_DIR = path.join(ROOT, 'docs');
const ASSETS_DIR = path.join(ROOT, 'assets');

const SITE = {
  title: 'Cain',
  tagline: 'Devblog',
  description:
    'Development log for Cain — a 2D action-platformer with deliberate, stamina-based combat and a hand-painted, organic world.',
  // Set this once you know the Pages URL, e.g. https://username.github.io/cain-devblog
  url: '',
};

// Tag → display order. Unlisted tags still work, they just sort last.
const TAG_ORDER = ['changelog', 'design', 'lore', 'art', 'tech', 'devlog'];

/* ══════════════════════════════════════════════════════════════════════════
   Markdown
   A deliberate subset: headings, paragraphs, bold/italic, inline code, links,
   images, lists, blockquotes, tables, fenced code, rules — plus three Cain
   extensions (status badges, spoiler blocks, video embeds).
   ══════════════════════════════════════════════════════════════════════════ */

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

function inline(src) {
  // Pull inline code out first so its contents are never treated as markup.
  const codes = [];
  let s = src.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000C${codes.length - 1}\u0000`;
  });

  s = esc(s);

  // Cain extension: status badges. Matches the convention already used in
  // Docs/TheWake.md, so design notes can be pasted in and just work.
  s = s.replace(
    /\*\*(LOCKED|PROPOSED|OPEN|CUT|DONE|WIP|NEW|CHANGED|FIXED)\b([^*]*)\*\*/g,
    (_, kind, rest) =>
      `<span class="badge badge-${kind.toLowerCase()}">${kind}${esc(rest.trimEnd())}</span>`
  );

  s = s.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_, alt, src2) => `<img src="${src2}" alt="${alt}" loading="lazy">`
  );
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => {
    const ext = /^https?:\/\//.test(href) ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${href}"${ext}>${text}</a>`;
  });

  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,;:!?])/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  s = s.replace(/\u0000C(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
  return s;
}

function renderMarkdown(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const headings = [];
  let i = 0;

  const isBlank = (l) => !l || !l.trim();

  while (i < lines.length) {
    const line = lines[i];

    // ── fenced code ──
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++; // closing fence
      out.push(
        `<pre class="code"${lang ? ` data-lang="${esc(lang)}"` : ''}><code>${esc(
          buf.join('\n')
        )}</code></pre>`
      );
      continue;
    }

    // ── Cain extension: spoiler block ──
    //   :::spoiler Optional summary
    //   hidden content
    //   :::
    if (/^:::\s*spoiler/i.test(line)) {
      const summary = line.replace(/^:::\s*spoiler\s*/i, '').trim() || 'Spoiler — click to reveal';
      const buf = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++;
      const { html } = renderMarkdown(buf.join('\n'));
      out.push(
        `<details class="spoiler"><summary>${inline(summary)}</summary><div class="spoiler-body">${html}</div></details>`
      );
      continue;
    }

    // ── Cain extension: video embed ──
    if (/^@youtube\(([^)]+)\)\s*$/.test(line)) {
      const id = line.match(/^@youtube\(([^)]+)\)\s*$/)[1].trim();
      out.push(
        `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${esc(
          id
        )}" title="Video" loading="lazy" allowfullscreen frameborder="0"></iframe></div>`
      );
      i++;
      continue;
    }

    // ── horizontal rule ──
    if (/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // ── heading ──
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      const id = slugify(text);
      if (level === 2 || level === 3) headings.push({ level, text, id });
      out.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    // ── table ──
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const cells = (l) =>
        l
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
      const head = cells(line);
      const align = cells(lines[i + 1]).map((c) =>
        /^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : 'left'
      );
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      const th = head
        .map((c, n) => `<th style="text-align:${align[n] || 'left'}">${inline(c)}</th>`)
        .join('');
      const tb = rows
        .map(
          (r) =>
            `<tr>${r
              .map((c, n) => `<td style="text-align:${align[n] || 'left'}">${inline(c)}</td>`)
              .join('')}</tr>`
        )
        .join('');
      out.push(`<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tb}</tbody></table></div>`);
      continue;
    }

    // ── blockquote ──
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      const { html } = renderMarkdown(buf.join('\n'));
      out.push(`<blockquote>${html}</blockquote>`);
      continue;
    }

    // ── lists (supports one level of nesting via 2+ space indent) ──
    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && (/^\s*(?:[-*+]|\d+\.)\s+/.test(lines[i]) || (items.length && /^\s{2,}\S/.test(lines[i])))) {
        const m = lines[i].match(/^(\s*)(?:[-*+]|\d+\.)\s+(.*)$/);
        if (m) {
          items.push({ indent: m[1].length, text: m[2], sub: [] });
        } else if (items.length) {
          // continuation / nested content of the previous item
          items[items.length - 1].sub.push(lines[i].replace(/^\s{2}/, ''));
        }
        i++;
      }
      const render = (list) =>
        list
          .map((it) => {
            let body = inline(it.text);
            if (it.sub.length) {
              const { html } = renderMarkdown(it.sub.join('\n'));
              body += html;
            }
            return `<li>${body}</li>`;
          })
          .join('');
      // Group by indent: anything deeper than the first item nests under it.
      const base = items[0].indent;
      const tree = [];
      for (const it of items) {
        if (it.indent > base && tree.length) tree[tree.length - 1].children.push(it);
        else tree.push({ ...it, children: [] });
      }
      const html = tree
        .map((it) => {
          let body = inline(it.text);
          if (it.sub.length) body += renderMarkdown(it.sub.join('\n')).html;
          if (it.children.length) body += `<ul>${render(it.children)}</ul>`;
          return `<li>${body}</li>`;
        })
        .join('');
      out.push(ordered ? `<ol>${html}</ol>` : `<ul>${html}</ul>`);
      continue;
    }

    // ── blank ──
    if (isBlank(line)) {
      i++;
      continue;
    }

    // ── paragraph ──
    const buf = [];
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !/^(?:#{1,4}\s|```|:::|\s*>|\s*(?:[-*+]|\d+\.)\s|\s*\||@youtube\()/.test(lines[i]) &&
      !/^\s*(?:---+|\*\*\*+|___+)\s*$/.test(lines[i])
    ) {
      buf.push(lines[i++]);
    }
    if (buf.length) out.push(`<p>${inline(buf.join('\n'))}</p>`);
    else i++; // safety: never spin
  }

  return { html: out.join('\n'), headings };
}

/* ══════════════════════════════════════════════════════════════════════════
   Posts
   ══════════════════════════════════════════════════════════════════════════ */

function parseFrontmatter(raw) {
  const meta = {};
  let body = raw;
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (m) {
    body = raw.slice(m[0].length);
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (kv) meta[kv[1].trim()] = kv[2].trim().replace(/^["'](.*)["']$/, '$1');
    }
  }
  return { meta, body };
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  const posts = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);

    // Date and slug fall back to the filename, so frontmatter stays optional.
    const fromName = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    const date = meta.date || (fromName ? fromName[1] : null);
    if (!date) {
      console.warn(`  ! skipped ${file} — no date in frontmatter or filename`);
      continue;
    }
    const slug = meta.slug || (fromName ? fromName[2] : file.replace(/\.md$/, ''));

    // Title falls back to the first H1, which is then stripped from the body.
    let content = body;
    let title = meta.title;
    const h1 = content.match(/^\s*#\s+(.+)$/m);
    if (!title && h1) title = h1[1].trim();
    if (h1 && slugify(h1[1].trim()) === slugify(title || '')) {
      content = content.replace(h1[0], '');
    }
    title = title || slug;

    const tags = (meta.tags || '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const { html, headings } = renderMarkdown(content);

    // Excerpt: first real paragraph, stripped to plain text.
    const firstPara = html.match(/<p>([\s\S]*?)<\/p>/);
    const excerpt = firstPara
      ? firstPara[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 240)
      : '';

    posts.push({ file, slug, date, title, tags, html, headings, excerpt, summary: meta.summary || '' });
  }

  // Newest first; same-day posts keep a stable order by slug.
  posts.sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date.localeCompare(a.date)));
  return posts;
}

/* ══════════════════════════════════════════════════════════════════════════
   Templates
   ══════════════════════════════════════════════════════════════════════════ */

function layout({ title, description, body, cls = '', rel = '' }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="alternate" type="application/rss+xml" title="${esc(SITE.title)} devblog" href="${rel}feed.xml">
<link rel="stylesheet" href="${rel}style.css">
</head>
<body class="${cls}">
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <a class="brand" href="${rel}index.html">
    <span class="brand-mark">${esc(SITE.title)}</span>
    <span class="brand-sub">${esc(SITE.tagline)}</span>
  </a>
  <nav class="site-nav">
    <a href="${rel}index.html">Archive</a>
    <a href="${rel}feed.xml">RSS</a>
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <p>Cain is in active development. Everything here is subject to change — that is rather the point.</p>
</footer>
</body>
</html>`;
}

function tagChip(t, rel = '') {
  return `<span class="tag tag-${esc(t)}">${esc(t)}</span>`;
}

function renderIndex(posts) {
  const allTags = [...new Set(posts.flatMap((p) => p.tags))].sort(
    (a, b) => (TAG_ORDER.indexOf(a) + 1 || 99) - (TAG_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b)
  );

  // Group by month so a long archive stays scannable.
  const groups = [];
  for (const p of posts) {
    const key = p.date.slice(0, 7);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(p);
    else groups.push({ key, items: [p] });
  }

  const filters = allTags.length
    ? `<div class="filters" role="group" aria-label="Filter posts by tag">
  <button class="filter is-on" data-tag="*">All</button>
  ${allTags.map((t) => `<button class="filter" data-tag="${esc(t)}">${esc(t)}</button>`).join('\n  ')}
</div>`
    : '';

  const list = groups
    .map(
      (g) => `<section class="month" data-month="${g.key}">
  <h2 class="month-label">${MONTHS[Number(g.key.slice(5, 7)) - 1]} ${g.key.slice(0, 4)}</h2>
  <ol class="posts">
${g.items
  .map(
    (p) => `    <li class="post-row" data-tags="${p.tags.join(' ')}">
      <a class="post-link" href="posts/${p.slug}.html">
        <time class="post-date" datetime="${p.date}">${p.date.slice(8)} ${MONTHS[Number(p.date.slice(5, 7)) - 1].slice(0, 3)}</time>
        <span class="post-body">
          <span class="post-title">${esc(p.title)}</span>
          ${p.summary || p.excerpt ? `<span class="post-excerpt">${esc(p.summary || p.excerpt)}</span>` : ''}
          ${p.tags.length ? `<span class="post-tags">${p.tags.map((t) => tagChip(t)).join('')}</span>` : ''}
        </span>
      </a>
    </li>`
  )
  .join('\n')}
  </ol>
</section>`
    )
    .join('\n');

  const body = `<div class="hero">
  <h1>Building <em>Cain</em></h1>
  <p class="lede">${esc(SITE.description)}</p>
  <p class="hero-meta">${posts.length} ${posts.length === 1 ? 'entry' : 'entries'}${
    posts.length ? ` &middot; latest ${formatDate(posts[0].date)}` : ''
  }</p>
</div>
${filters}
<div class="archive">
${list || '<p class="empty">No entries yet.</p>'}
</div>
<p class="no-results" hidden>Nothing tagged that yet.</p>
<script>
(() => {
  const buttons = [...document.querySelectorAll('.filter')];
  const rows = [...document.querySelectorAll('.post-row')];
  const months = [...document.querySelectorAll('.month')];
  const none = document.querySelector('.no-results');
  buttons.forEach(b => b.addEventListener('click', () => {
    const tag = b.dataset.tag;
    buttons.forEach(x => x.classList.toggle('is-on', x === b));
    let shown = 0;
    rows.forEach(r => {
      const ok = tag === '*' || r.dataset.tags.split(' ').includes(tag);
      r.hidden = !ok;
      if (ok) shown++;
    });
    months.forEach(m => {
      m.hidden = ![...m.querySelectorAll('.post-row')].some(r => !r.hidden);
    });
    none.hidden = shown > 0;
  }));
})();
</script>`;

  return layout({ title: `${SITE.title} — ${SITE.tagline}`, description: SITE.description, body, cls: 'page-index' });
}

function renderPost(post, prev, next) {
  const toc =
    post.headings.filter((h) => h.level === 2).length >= 3
      ? `<nav class="toc" aria-label="On this page">
  <p class="toc-label">On this page</p>
  <ol>${post.headings
    .filter((h) => h.level === 2)
    .map((h) => `<li><a href="#${h.id}">${esc(h.text)}</a></li>`)
    .join('')}</ol>
</nav>`
      : '';

  const body = `<article class="post">
  <header class="post-head">
    <p class="crumb"><a href="../index.html">&larr; All entries</a></p>
    <h1>${esc(post.title)}</h1>
    <p class="post-meta">
      <time datetime="${post.date}">${formatDate(post.date)}</time>
      ${post.tags.length ? `<span class="post-tags">${post.tags.map((t) => tagChip(t)).join('')}</span>` : ''}
    </p>
  </header>
  ${toc}
  <div class="prose">
${post.html}
  </div>
</article>
<nav class="post-nav">
  ${next ? `<a class="nav-prev" href="${next.slug}.html"><span>Previous</span><strong>${esc(next.title)}</strong></a>` : '<span></span>'}
  ${prev ? `<a class="nav-next" href="${prev.slug}.html"><span>Next</span><strong>${esc(prev.title)}</strong></a>` : '<span></span>'}
</nav>`;

  return layout({
    title: `${post.title} — ${SITE.title}`,
    description: post.summary || post.excerpt || SITE.description,
    body,
    cls: 'page-post',
    rel: '../',
  });
}

function renderFeed(posts) {
  const base = SITE.url.replace(/\/$/, '');
  const items = posts
    .slice(0, 30)
    .map(
      (p) => `  <item>
    <title>${esc(p.title)}</title>
    <link>${base}/posts/${p.slug}.html</link>
    <guid isPermaLink="false">cain-${p.date}-${p.slug}</guid>
    <pubDate>${new Date(p.date + 'T12:00:00Z').toUTCString()}</pubDate>
    <description>${esc(p.summary || p.excerpt)}</description>
  </item>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${esc(SITE.title)} — ${esc(SITE.tagline)}</title>
  <link>${base}/</link>
  <description>${esc(SITE.description)}</description>
  <language>en</language>
${items}
</channel>
</rss>`;
}

/* ══════════════════════════════════════════════════════════════════════════
   Build
   ══════════════════════════════════════════════════════════════════════════ */

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  fs.mkdirSync(to, { recursive: true });
  let n = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) n += copyDir(src, dst);
    else {
      fs.copyFileSync(src, dst);
      n++;
    }
  }
  return n;
}

function build() {
  const t0 = Date.now();
  const posts = loadPosts();

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT_DIR, 'posts'), { recursive: true });

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), renderIndex(posts));

  posts.forEach((p, n) => {
    // posts[] is newest-first, so the *previous* entry chronologically is at n+1.
    fs.writeFileSync(path.join(OUT_DIR, 'posts', `${p.slug}.html`), renderPost(p, posts[n - 1], posts[n + 1]));
  });

  fs.writeFileSync(path.join(OUT_DIR, 'feed.xml'), renderFeed(posts));
  fs.writeFileSync(path.join(OUT_DIR, 'style.css'), CSS);
  // Stops GitHub Pages running the output through Jekyll.
  fs.writeFileSync(path.join(OUT_DIR, '.nojekyll'), '');

  const assets = copyDir(ASSETS_DIR, path.join(OUT_DIR, 'assets'));

  console.log(`  ${posts.length} post${posts.length === 1 ? '' : 's'}, ${assets} asset${assets === 1 ? '' : 's'} -> docs/  (${Date.now() - t0}ms)`);
  if (!posts.length) console.log('  (no posts yet — run: npm run new "Your title")');
  return posts;
}

function newPost(title) {
  if (!title) {
    console.error('Usage: npm run new "Post title"');
    process.exit(1);
  }
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const slug = slugify(title);
  const file = path.join(POSTS_DIR, `${date}-${slug}.md`);
  if (fs.existsSync(file)) {
    console.error(`Already exists: ${path.relative(ROOT, file)}`);
    process.exit(1);
  }
  fs.mkdirSync(POSTS_DIR, { recursive: true });
  fs.writeFileSync(
    file,
    `---
title: ${title}
date: ${date}
tags: changelog
summary:
---

Write here. Delete whatever you don't need.

## What changed

-

## Why

`
  );
  console.log(`Created posts/${date}-${slug}.md`);
}

function serve(port = 8080) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.woff2': 'font/woff2',
    '.mp4': 'video/mp4',
  };
  http
    .createServer((req, res) => {
      // Rebuild on every navigation so edits show up on refresh.
      let url = decodeURIComponent(req.url.split('?')[0]);
      if (url.endsWith('/')) url += 'index.html';
      if (url.endsWith('.html') || url === '/index.html') {
        try {
          build();
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          return res.end(`Build error:\n\n${e.stack}`);
        }
      }
      const file = path.join(OUT_DIR, path.normalize(url).replace(/^(\.\.[/\\])+/, ''));
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end('<h1>404</h1><p><a href="/">Back to the archive</a></p>');
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    })
    .listen(port, () => {
      console.log(`\n  Preview:  http://localhost:${port}\n  Rebuilds on every page load. Ctrl+C to stop.\n`);
    });
}

/* ══════════════════════════════════════════════════════════════════════════
   Styles — dark only, on purpose. The site should feel like the game.
   ══════════════════════════════════════════════════════════════════════════ */

const CSS = `/* Generated by build.mjs — edit the CSS constant there, not this file. */

@font-face {
  font-family: 'Crimson Text';
  src: url('assets/fonts/CrimsonText-Regular.ttf') format('truetype');
  font-weight: 400; font-style: normal; font-display: swap;
}
@font-face {
  font-family: 'Crimson Text';
  src: url('assets/fonts/CrimsonText-Italic.ttf') format('truetype');
  font-weight: 400; font-style: italic; font-display: swap;
}
@font-face {
  font-family: 'Crimson Text';
  src: url('assets/fonts/CrimsonText-SemiBold.ttf') format('truetype');
  font-weight: 600; font-style: normal; font-display: swap;
}
@font-face {
  font-family: 'JetBrains Mono';
  src: url('assets/fonts/JetBrainsMono-Regular.ttf') format('truetype');
  font-weight: 400; font-style: normal; font-display: swap;
}

:root {
  --bg:        #12100d;
  --bg-raise:  #191612;
  --surface:   #1e1a15;
  --line:      #2c2720;
  --line-soft: #221e19;
  --ink:       #ddd6c8;
  --ink-dim:   #9a9081;
  --ink-faint: #6d6459;
  --amber:     #c99247;
  --amber-dim: #8c6631;
  --moss:      #7d8b64;
  --rust:      #a9603c;

  --serif: 'Crimson Text', Georgia, 'Times New Roman', serif;
  --mono:  'JetBrains Mono', ui-monospace, 'Cascadia Code', Consolas, monospace;

  --measure: 34rem;
  --pad: clamp(1.25rem, 4vw, 2.5rem);
}

*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--serif);
  font-size: clamp(1.0625rem, 0.4vw + 1rem, 1.1875rem);
  line-height: 1.65;
  /* Faint vertical haze — echoes the game's mist without costing anything. */
  background-image: radial-gradient(120% 80% at 50% -10%, #1c1813 0%, transparent 60%);
  background-repeat: no-repeat;
}

.skip {
  position: absolute; left: -9999px;
  background: var(--amber); color: #14110c;
  padding: .5rem .9rem; z-index: 10;
}
.skip:focus { left: 1rem; top: 1rem; }

a { color: var(--amber); text-decoration-color: var(--amber-dim); text-underline-offset: .18em; }
a:hover { color: #e0ab5e; }

:focus-visible { outline: 2px solid var(--amber); outline-offset: 3px; }

/* ── header / footer ───────────────────────────────────────────────── */

.site-head {
  display: flex; align-items: baseline; justify-content: space-between;
  flex-wrap: wrap; gap: 1rem;
  max-width: 62rem; margin: 0 auto;
  padding: 2rem var(--pad) 1.25rem;
  border-bottom: 1px solid var(--line-soft);
}
.brand { text-decoration: none; display: flex; align-items: baseline; gap: .6rem; }
.brand-mark {
  font-family: var(--mono);
  font-size: .95rem; letter-spacing: .34em; text-transform: uppercase;
  color: var(--ink);
}
.brand-sub {
  font-family: var(--mono);
  font-size: .7rem; letter-spacing: .22em; text-transform: uppercase;
  color: var(--ink-faint);
}
.site-nav { display: flex; gap: 1.25rem; }
.site-nav a {
  font-family: var(--mono); font-size: .7rem;
  letter-spacing: .16em; text-transform: uppercase;
  color: var(--ink-dim); text-decoration: none;
}
.site-nav a:hover { color: var(--amber); }

main { max-width: 62rem; margin: 0 auto; padding: 0 var(--pad) 4rem; }

.site-foot {
  max-width: 62rem; margin: 0 auto;
  padding: 2rem var(--pad) 4rem;
  border-top: 1px solid var(--line-soft);
  color: var(--ink-faint); font-size: .9rem; font-style: italic;
}

/* ── index ─────────────────────────────────────────────────────────── */

.hero { padding: 3.5rem 0 2rem; max-width: var(--measure); }
.hero h1 {
  font-size: clamp(2.1rem, 5vw, 3.1rem); font-weight: 600;
  line-height: 1.1; margin: 0 0 .6rem; letter-spacing: -0.01em;
}
.hero h1 em { color: var(--amber); font-style: italic; }
.lede { color: var(--ink-dim); margin: 0 0 1rem; font-size: 1.075rem; }
.hero-meta {
  font-family: var(--mono); font-size: .7rem;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--ink-faint); margin: 0;
}

.filters { display: flex; flex-wrap: wrap; gap: .4rem; margin: 0 0 2.5rem; }
.filter {
  font-family: var(--mono); font-size: .68rem;
  letter-spacing: .12em; text-transform: uppercase;
  background: transparent; color: var(--ink-dim);
  border: 1px solid var(--line); border-radius: 2px;
  padding: .38rem .7rem; cursor: pointer;
  transition: color .15s, border-color .15s, background .15s;
}
.filter:hover { color: var(--ink); border-color: var(--ink-faint); }
.filter.is-on { color: #14110c; background: var(--amber); border-color: var(--amber); }

.month { margin-bottom: 2.75rem; }
.month[hidden] { display: none; }
.month-label {
  font-family: var(--mono); font-size: .68rem;
  letter-spacing: .2em; text-transform: uppercase;
  color: var(--ink-faint); font-weight: 400;
  margin: 0 0 .5rem; padding-bottom: .5rem;
  border-bottom: 1px solid var(--line-soft);
}

.posts { list-style: none; margin: 0; padding: 0; }
.post-row { border-bottom: 1px solid var(--line-soft); }
.post-row[hidden] { display: none; }

.post-link {
  display: grid; grid-template-columns: 5.5rem 1fr; gap: 1.25rem;
  padding: 1.15rem .5rem 1.15rem .25rem;
  text-decoration: none; color: inherit;
  transition: background .15s;
}
.post-link:hover { background: var(--bg-raise); }
.post-date {
  font-family: var(--mono); font-size: .72rem;
  letter-spacing: .1em; text-transform: uppercase;
  color: var(--ink-faint); padding-top: .35rem; white-space: nowrap;
}
.post-link:hover .post-date { color: var(--amber-dim); }
.post-body { display: block; min-width: 0; }
.post-title {
  display: block; font-size: 1.3rem; font-weight: 600;
  line-height: 1.25; color: var(--ink); margin-bottom: .2rem;
}
.post-link:hover .post-title { color: var(--amber); }
.post-excerpt {
  display: block; color: var(--ink-dim); font-size: .98rem;
  line-height: 1.5; margin-bottom: .45rem;
}
.post-tags { display: flex; flex-wrap: wrap; gap: .35rem; }

.tag {
  font-family: var(--mono); font-size: .6rem;
  letter-spacing: .13em; text-transform: uppercase;
  color: var(--ink-faint); border: 1px solid var(--line);
  border-radius: 2px; padding: .16rem .45rem;
}
.tag-lore     { color: var(--moss);  border-color: #3a4232; }
.tag-design   { color: var(--amber-dim); border-color: #453a22; }
.tag-changelog{ color: var(--ink-dim); }
.tag-tech     { color: #6f8496; border-color: #2f3d47; }
.tag-art      { color: var(--rust);  border-color: #46281a; }

.no-results { color: var(--ink-faint); font-style: italic; }
.empty { color: var(--ink-faint); font-style: italic; }

/* ── post ──────────────────────────────────────────────────────────── */

.post { padding-top: 2.5rem; }
.crumb {
  font-family: var(--mono); font-size: .68rem;
  letter-spacing: .14em; text-transform: uppercase; margin: 0 0 1.75rem;
}
.crumb a { color: var(--ink-faint); text-decoration: none; }
.crumb a:hover { color: var(--amber); }

.post-head { max-width: var(--measure); margin-bottom: 2.5rem; }
.post-head h1 {
  font-size: clamp(1.9rem, 4.5vw, 2.7rem); font-weight: 600;
  line-height: 1.15; margin: 0 0 .75rem; letter-spacing: -0.01em;
}
.post-meta {
  display: flex; align-items: center; flex-wrap: wrap; gap: .75rem;
  font-family: var(--mono); font-size: .7rem;
  letter-spacing: .14em; text-transform: uppercase;
  color: var(--ink-faint); margin: 0;
}

.toc {
  max-width: var(--measure); margin: 0 0 2.5rem;
  padding: 1rem 1.25rem; background: var(--bg-raise);
  border-left: 2px solid var(--line);
}
.toc-label {
  font-family: var(--mono); font-size: .62rem;
  letter-spacing: .18em; text-transform: uppercase;
  color: var(--ink-faint); margin: 0 0 .5rem;
}
.toc ol { margin: 0; padding-left: 1.1rem; }
.toc li { margin: .15rem 0; font-size: .95rem; }
.toc a { text-decoration: none; }
.toc a:hover { text-decoration: underline; }

.prose { max-width: var(--measure); }
.prose > * { margin-inline: 0; }
.prose p { margin: 0 0 1.3rem; }
.prose h2 {
  font-size: 1.5rem; font-weight: 600; line-height: 1.25;
  margin: 2.75rem 0 .85rem; padding-bottom: .4rem;
  border-bottom: 1px solid var(--line-soft);
}
.prose h3 { font-size: 1.2rem; font-weight: 600; margin: 2rem 0 .6rem; }
.prose h4 {
  font-family: var(--mono); font-size: .78rem;
  letter-spacing: .12em; text-transform: uppercase;
  color: var(--ink-dim); margin: 1.75rem 0 .5rem;
}
.prose ul, .prose ol { margin: 0 0 1.3rem; padding-left: 1.3rem; }
.prose li { margin: .35rem 0; }
.prose li > ul, .prose li > ol { margin: .35rem 0 .1rem; }
.prose img { max-width: 100%; height: auto; display: block; margin: 1.75rem 0; border: 1px solid var(--line); }
.prose hr { border: 0; border-top: 1px solid var(--line); margin: 2.5rem 0; }

.prose blockquote {
  margin: 1.75rem 0; padding: .2rem 0 .2rem 1.25rem;
  border-left: 2px solid var(--amber-dim);
  color: var(--ink-dim); font-style: italic;
}
.prose blockquote p:last-child { margin-bottom: 0; }

.prose code {
  font-family: var(--mono); font-size: .84em;
  background: var(--surface); color: #d9b784;
  padding: .12em .38em; border-radius: 2px;
  border: 1px solid var(--line-soft);
  word-break: break-word;
}
.code {
  font-family: var(--mono); font-size: .82rem; line-height: 1.6;
  background: var(--surface); color: var(--ink);
  border: 1px solid var(--line); border-left: 2px solid var(--amber-dim);
  padding: 1rem 1.15rem; margin: 1.75rem 0;
  overflow-x: auto;
}
.code code { background: none; border: 0; padding: 0; color: inherit; font-size: inherit; }
.code[data-lang]::before {
  content: attr(data-lang);
  display: block; font-size: .62rem; letter-spacing: .16em;
  text-transform: uppercase; color: var(--ink-faint); margin-bottom: .6rem;
}

/* Tables are load-bearing here — the changelog posts live on before/after. */
.table-wrap { overflow-x: auto; margin: 1.75rem 0; }
.prose table { border-collapse: collapse; width: 100%; font-size: .92rem; }
.prose th, .prose td {
  padding: .5rem .8rem; border: 1px solid var(--line);
  vertical-align: top;
}
.prose th {
  font-family: var(--mono); font-size: .66rem;
  letter-spacing: .12em; text-transform: uppercase;
  color: var(--ink-dim); font-weight: 400; background: var(--bg-raise);
}
.prose td code { white-space: nowrap; }

.badge {
  font-family: var(--mono); font-size: .64rem; font-weight: 400;
  letter-spacing: .12em; text-transform: uppercase;
  padding: .16rem .45rem; border-radius: 2px;
  border: 1px solid currentColor; white-space: nowrap;
}
.badge-locked   { color: var(--moss); }
.badge-proposed { color: var(--amber); }
.badge-open     { color: var(--ink-dim); }
.badge-cut      { color: var(--rust); text-decoration: line-through; }
.badge-done     { color: var(--moss); }
.badge-wip      { color: var(--amber); }
.badge-new      { color: var(--moss); }
.badge-changed  { color: var(--amber); }
.badge-fixed    { color: var(--moss); }

.spoiler {
  margin: 1.75rem 0; border: 1px solid var(--line);
  background: var(--bg-raise); border-radius: 2px;
}
.spoiler summary {
  cursor: pointer; padding: .75rem 1rem;
  font-family: var(--mono); font-size: .7rem;
  letter-spacing: .12em; text-transform: uppercase; color: var(--amber);
  list-style: none;
}
.spoiler summary::-webkit-details-marker { display: none; }
.spoiler summary::before { content: '▸ '; }
.spoiler[open] summary::before { content: '▾ '; }
.spoiler summary:hover { color: #e0ab5e; }
.spoiler-body { padding: 0 1rem .25rem; border-top: 1px solid var(--line-soft); }
.spoiler-body > *:first-child { margin-top: 1rem; }

.embed { position: relative; padding-bottom: 56.25%; height: 0; margin: 1.75rem 0; border: 1px solid var(--line); }
.embed iframe { position: absolute; inset: 0; width: 100%; height: 100%; }

/* ── post nav ──────────────────────────────────────────────────────── */

.post-nav {
  display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
  margin-top: 3.5rem; padding-top: 1.75rem;
  border-top: 1px solid var(--line-soft);
}
.post-nav a {
  display: block; padding: .9rem 1rem; text-decoration: none;
  border: 1px solid var(--line); background: var(--bg-raise);
  transition: border-color .15s;
}
.post-nav a:hover { border-color: var(--amber-dim); }
.post-nav .nav-next { text-align: right; }
.post-nav span {
  display: block; font-family: var(--mono); font-size: .62rem;
  letter-spacing: .16em; text-transform: uppercase; color: var(--ink-faint);
  margin-bottom: .25rem;
}
.post-nav strong { display: block; font-weight: 600; color: var(--ink); font-size: 1rem; line-height: 1.3; }

@media (max-width: 34rem) {
  .post-link { grid-template-columns: 1fr; gap: .3rem; }
  .post-date { padding-top: 0; }
  .post-nav { grid-template-columns: 1fr; }
  .post-nav .nav-next { text-align: left; }
}

@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
`;

/* ══════════════════════════════════════════════════════════════════════════
   CLI
   ══════════════════════════════════════════════════════════════════════════ */

const args = process.argv.slice(2);
if (args[0] === '--new') {
  newPost(args.slice(1).join(' ').trim());
} else if (args[0] === '--serve') {
  build();
  serve(Number(args[1]) || 8080);
} else {
  build();
}
