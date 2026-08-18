---
title: The first rooms under the Wake
date: 2026-08-17
tags: tech, design
summary: Two cave rooms went in. Between them they exposed a room-sizing mistake, a collider bug that had been there all along, and an erosion model that couldn't do the thing I wanted it to.
---

The Wake's caves are the same skill as its surface with the senses swapped — up there you read the
forest to find things, down here it reads you. I built the first two rooms of it: the bottom of the
shaft you arrive in, and one chamber with a wretch in it that has no eyes at all.

They're a separate region rather than more rooms in the Wake. That's not a tidiness choice: the
directional light and the mist live on the region map, not on the room, so cave rooms inside the Wake
would be lit by the forest's sun with nothing to override it per-room. As their own region they get
their own light, palette, fog and generation config, and the region is placed away from everything
else and reached only through an entrance. The entrance sits at the bottom of the ravine in the new
root bridge room, so the way underground is found by dropping through the hole in the root mat for
the chest — you're not offered it at the door.

Then three things broke.

## The rooms were smaller than the screen

Two bugs got reported and they turned out to be the same one. The tiles didn't cover the camera, and
you could see sky through the sloped tiles at the edges.

The camera is orthographic size 2.1. That's 4.2 by 7.47 world units, and a tile is 0.1 — so the
screen is **42 tiles tall and about 75 wide**. My first pass at these rooms was 48×34 and 64×34.
Smaller than the screen in both directions. The camera was seeing past the room into the void, and at
a sloped boundary tile the diagonal let the void through, which reads exactly like the background
failing to draw.

| | first pass | now |
|---|---|---|
| landing | 48 × 34 | 88 × 52 |
| gallery | 64 × 34 | 104 × 52 |

An enclosed room needs solid rock margin around the playable space — about 21 tiles above and below
anywhere Cain can stand, more if he can jump onto something. Surface rooms get away with being
narrow because the next room along fills the rest of the frame. A cave has nothing next to it.

## Three minutes to build the world

Adding those two rooms took Build Region from 69 seconds to 178.

| | before | after |
|---|---|---|
| room bake | 21 s | 124 s |
| region MG/BG | 37 s | 40 s |
| **total** | **69 s** | **178 s** |

The build logs its own breakdown, which is the only reason this took ten minutes to find instead of
an afternoon. Foreground collider generation was **119 seconds of it — 53.6% of the entire build**.

The collider builder added one `PolygonCollider2D` component per collidable tile, all to the same
object. Unity's `AddComponent` is linear in the components already on the object, so the cost was
quadratic in the room's tile count. It had been in there the whole time and never mattered, because
every room until now was about half air. A cave room carved out of solid rock is 100% filled.

Two fixes. Square tiles now merge into the largest rectangles that fit and everything goes into a
single collider with many paths — 1,388 collidable cells became 94 paths on 2 components instead of
1,388 components. And the deep margin isn't collidable any more: it exists so the camera sees stone
instead of void, and rock the player can never touch has no business generating physics. It still
bakes identically, it just doesn't collide.

The margin keeps a four-tile collidable shell against every open cell. Four because Cain covers 1.44
tiles in one physics step at maximum fall speed, so nothing can tunnel through it.

## Erosion that couldn't stop making straight lines

The cave walls read as squares. Edge erosion was already on and already pointed at the right
material — it carves pixels to nothing along air-exposed edges, which is exactly the right mechanism
— but it's a dither. Each pixel in a four-pixel band carves if noise falls under a threshold, and the
threshold is 0.292, so under a third of a thin band goes.

The deeper problem is that a dither *can't* give me what I want. Wherever the noise happens to sit
high across a whole tile face, that face survives dead straight — and a straight face is the sharp
square I'm trying to get rid of.

So cave rock uses a different model. Noise picks how *deep* the bite is, never whether there is one:

```
bite = lerp(minBite, maxBite, noise)     // 2px to 7px of a 10px tile
```

Because the minimum isn't zero, every air-exposed edge in the caves loses at least two pixels. No
straight edges anywhere, by construction rather than by luck. Two octaves feed it — a single
high-frequency noise sands the edge evenly and still looks machined, and it's the coarse octave
taking big irregular bites that reads as rock.

One catch I hit while writing it: colliders sit at the full tile boundary whatever the pixels do, so
a guaranteed bite out of the *up-facing* face would drop every floor two pixels and leave Cain
hovering over it. Walkable tops are capped at one pixel; sides, undersides and slope faces take the
full bite.

The strength settings used to be global, which is why this couldn't just be turned up. Surface
terrain gets its large-scale shape from the warp bending the whole ground line, so its erosion only
needs to be a fine chip on top. Underground there's no warp and the tile grid *is* the wall. It's a
per-material setting now, and the old materials inherit the old behaviour unchanged.

## Still open

**PROPOSED** — none of the three fixes has been baked and looked at yet. The build time and the
erosion are both numbers I've reasoned about rather than seen.

The wretch down there hunts purely by sound: it never sees Cain, it chases the last position it
*heard*, so going quiet drops it mid-chase. Crouch-walking is already silent and running already
carries, so most of that existed. What doesn't exist is any way to make a noise somewhere Cain
isn't — he can be quiet, but he can't lie. That's the missing half and it's the next thing.

The other open question is whether sound should travel around corners. Hearing is currently blocked
by a terrain raycast, which was a fix for wolves hearing through the treehouse floorboards. Down here
it means every chamber is sealed and hunting stops at the chamber wall. Real caves carry sound around
corners and that's most of what makes them frightening. I've deliberately left it as-is for the first
chamber, because I don't think I can judge that one from a description — it either feels tense or it
feels dead, and I'll know in about thirty seconds of playing it.
