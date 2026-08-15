# Cain devblog

The devblog for **Cain**, my 2D action-platformer built in Unity.

Static site generator in one file, **zero dependencies**. There is no `npm install` — the
whole toolchain is `node build.mjs`, so it can't rot while I'm busy making the game.

## Adding a post

```bash
node build.mjs --new "Some title"   # creates posts/YYYY-MM-DD-some-title.md
node build.mjs --serve              # preview at localhost:8080, rebuilds on refresh
node build.mjs                      # build docs/ for publishing
```

Then commit and push. GitHub Pages serves `docs/` directly — no CI, no cloud build step,
nothing to break.

## Writing a post

A post is a markdown file in `posts/`. Front matter is optional — without it the date comes
from the filename and the title from the first `#` heading.

```markdown
---
title: Reading the forest
date: 2026-08-02
tags: design, lore
summary: One line for the archive listing and the RSS feed.
---

Body goes here.
```

Tags in use: `changelog`, `design`, `lore`, `art`, `tech`, `devlog`. The index page filters by
them. New tags work automatically; they just sort after the known ones.

### Beyond standard markdown

Standard markdown all works — headings, **bold**, *italic*, `code`, lists, links, images,
blockquotes, tables, fenced code blocks. Plus three additions:

**Status badges.** These render as coloured badges, and match the convention already used in
`Docs/TheWake.md`, so design notes paste straight in:

```markdown
**LOCKED 2026-08-02**   **PROPOSED**   **OPEN**   **CUT**
**WIP**   **NEW**   **CHANGED**   **FIXED**
```

**Spoiler blocks**, for lore I don't want to hand a first-time player:

```markdown
:::spoiler What's actually under the monument
Hidden until clicked.
:::
```

**Video embeds**, for devlog companion posts:

```markdown
@youtube(dQw4w9WgXcQ)
```

## How it's published

GitHub Pages, straight from the repo — **Settings → Pages**, source *Deploy from a branch*,
branch `main`, folder **`/docs`**. Live at <https://princejkb.github.io/cain-devblog/>.

Publishing is `git push`. Nothing else runs.

One thing still outstanding: `SITE.url` near the top of `build.mjs` is empty, so the RSS feed
emits relative links. Setting it to the Pages URL fixes that.

## Layout

```
posts/        the markdown — the only folder I touch
assets/       fonts, and any images posts reference
build.mjs     the whole generator: markdown parser, templates, CSS, RSS, dev server
docs/         generated output. GitHub Pages serves this. Never edit by hand.
```

`docs/` is committed on purpose. It's what makes publishing a plain `git push` with no CI.

## Design notes

Dark only, deliberately — the site should feel like the game rather than like a blog platform.
Type is **Crimson Text** for prose and **JetBrains Mono** for metadata and code, both
self-hosted from the copies already in the Unity project, both OFL licensed.

Colours are pulled toward Cain's palette: near-black warm ground, dusty ochre text, amber
accent. Status badges borrow the region-bible vocabulary — moss green for locked, amber for
proposed, rust for cut.

To change the look, edit the `CSS` constant in `build.mjs`. Editing `docs/style.css` directly
does nothing; it's overwritten on every build.
