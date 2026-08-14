# Cain devblog

The devblog for **Cain**, a 2D action-platformer built in Unity.

Static site generator in one file, **zero dependencies**. There is no `npm install`. The
entire toolchain is `node build.mjs`, which means this cannot rot out from under you while
you're busy making the game.

## Adding a post

The fast way — from anywhere in the Cain project, in Claude Code:

```
/devlog
```

It reads what actually changed in the game repo since the last entry, drafts the post, and
publishes once you've approved it.

The manual way:

```bash
node build.mjs --new "Some title"   # creates posts/YYYY-MM-DD-some-title.md
node build.mjs --serve              # preview at localhost:8080, rebuilds on refresh
node build.mjs                      # build docs/ for publishing
```

Then commit and push. GitHub Pages serves `docs/` directly — no CI, no build step in the
cloud, nothing to break.

## Writing a post

A post is a markdown file in `posts/`. Front matter is optional — if you leave it out, the
date comes from the filename and the title from the first `#` heading.

```markdown
---
title: Reading the forest
date: 2026-08-02
tags: design, lore
summary: One line for the archive listing and the RSS feed.
---

Body goes here.
```

Tags in use: `changelog`, `design`, `lore`, `art`, `tech`, `devlog`. The index page filters
by them. New tags work automatically; they just sort after the known ones.

### Beyond standard markdown

Standard markdown all works — headings, **bold**, *italic*, `code`, lists, links, images,
blockquotes, tables, fenced code blocks. Plus three additions:

**Status badges.** These render as coloured badges, and match the convention already used in
`Docs/TheWake.md`, so design notes can be pasted straight in:

```markdown
**LOCKED 2026-08-02**   **PROPOSED**   **OPEN**   **CUT**
**WIP**   **NEW**   **CHANGED**   **FIXED**
```

**Spoiler blocks**, for lore you don't want to hand to a first-time player:

```markdown
:::spoiler What's actually under the monument
Hidden until clicked.
:::
```

**Video embeds**, for devlog companion posts:

```markdown
@youtube(dQw4w9WgXcQ)
```

## Publishing to GitHub Pages

One-time setup:

1. Create a **public** repo on github.com named `cain-devblog`. Don't initialise it with
   anything — no README, no `.gitignore`.
2. Connect and push:
   ```bash
   git remote add origin https://github.com/<you>/cain-devblog.git
   git branch -M main
   git push -u origin main
   ```
3. Repo **Settings → Pages**. Source: *Deploy from a branch*. Branch: `main`, folder:
   **`/docs`**. Save.
4. Wait a minute, then open `https://<you>.github.io/cain-devblog/`.
5. Put that URL into the `SITE.url` field near the top of `build.mjs` so the RSS feed emits
   absolute links, then rebuild and push.

After that, publishing is `git push`.

## Layout

```
posts/        the markdown you write — the only folder you need to touch
assets/       fonts, and any images you reference from posts
build.mjs     the whole generator: markdown parser, templates, CSS, RSS, dev server
docs/         generated output. GitHub Pages serves this. Never edit by hand.
```

`docs/` is committed on purpose. It's what makes publishing a plain `git push` with no CI.

## Design notes

Dark only, deliberately — the site should feel like the game rather than like a blog
platform. Type is **Crimson Text** for prose and **JetBrains Mono** for metadata and code,
both self-hosted from the copies already in the Unity project, both OFL licensed.

Colours are pulled toward Cain's palette: near-black warm ground, dusty ochre text, amber
accent. Status badges borrow the region-bible vocabulary — moss green for locked, amber for
proposed, rust for cut.

To change the look, edit the `CSS` constant in `build.mjs`. Editing `docs/style.css` directly
does nothing; it's overwritten on every build.
