---
title: Filling in the treehouse
date: 2026-08-15
tags: tech, design
summary: Five new treehouse rooms, and the two bake bugs that turned up once the interiors were properly filled in.
---

The treehouse now runs from the ladder room out to both ends. Five new rooms: the workshop, the
tally, a west span, the post, and Vassen's quarters. I also repainted the five older rooms, because
they were mostly empty inside and the new ones weren't.

The old rooms were 30-50% filled. The new ones are 90-98%. Filling them in broke two things in the
bake pipeline, and both had the same cause: the pipeline treats painted scenery as if it were solid
ground.

## The rooms baked black

The higher rooms came out completely black. The props inside them were lit correctly, which is what
pointed at the cause — the darkness was baked into the albedo, so lighting couldn't undo it.

The depth-darken pass exists to make the inside of a rock mass dark. Anything more than 2.5 tiles
from open air bakes to the darkest palette colour. The problem is that it measures that distance
using every solid cell, including background scenery. Scenery is a wall painted behind the room, not
rock, and Cain walks straight through it. So a room that is 98% scenery measured as almost completely
buried.

The fix was to count only collidable cells as mass.

| room | black pixels before | after |
|---|---|---|
| Catchment | 85% | 14% |
| Larder | 95% | 10% |
| Workshop | 92% | 17% |
| Tally | 96% | 8% |
| Hut | 76% | 25% |
| Walk | 64% | 62% |

What's left is the inside of the floor slabs, which is real terrain and should be dark. The Walk
barely changed because it's a span with almost no scenery — nearly all of its painted content is
thick decking. That was a useful check that the fix hadn't just switched the effect off.

I fixed this at the wrong level twice before getting there, by adding `ignoreDepthDarkening` to
individual materials. That does work, and it's why the bug went unnoticed for so long: every material
the older rooms happened to use already had the flag set. The flags were covering up a bad mass map.

## Nothing under the rooms

Treehouse rooms don't contribute backdrop mass. If they did, each one would grow a blurred copy of
itself behind it, hanging in open sky. The downside is that there's nothing behind or below them, and
east of the ground rooms there's no terrain under the structure at all. They looked like they were
floating.

I tried scattering a canopy asset under each room first. That didn't work, for three reasons:

- A painted canvas is a fixed size, so it can't span the gap between the ground and a room at an
  arbitrary height. It never reached the ground.
- The canopy asset is drawn to hang from the top of the screen, so its top and sides are straight
  cuts that are normally off-screen. In mid-air those cuts are the outline, so it looked like a
  flat-topped rectangle.
- It's tuned as a dark ceiling, so it was far too dark for a tree crown.

So the canvas is generated per tree now. The trunk is however tall the gap needs, and the crown is a
few overlapping ellipses with noise on the edges so nothing comes out straight. It's still a normal
landmark canvas, which matters: that's what gives the bark and canopy fills the shape information
they need. The bark fill shades across the trunk so it looks round, and the canopy fill darkens the
underside and punches gaps through the leaves.

Trunks come out at 19 tiles under the catchment and 130 under Vassen's quarters, from the same rule.

Two more things I got wrong, both the same mistake as the first bug — fixing it one level too low:

- I sized the canvas to the crown's intended top, so the canvas edge cut the noise off in a straight
  line and the flat top came back.
- I made "is this already held up" a per-column check instead of per-room, so a room sitting on the
  one below still grew a tree under the part that overhung it.

## Windows

One design change while I was in there. Vassen is blind, and there are no light sources anywhere in
the treehouse. So windows are something a sighted person builds, and he built the place from the
bottom up over ten thousand years.

Windows now get rarer as you climb. The catchment has two. The larder has one, plus a blank panel
where the second would go. The workshop is glazed at its old end and panelled blind at its new end.
The tally and the quarters have none at all.

## Still open

The support trees are set to about 3.2 crowns deep on the back layers. **PROPOSED** — I haven't
baked it and looked at it yet. It's one number per rule. Too dense and the structure sits inside a
solid mass of leaves; too sparse and it reads as separate trees propping it up.

The vista from the post needs checking too. It pulls back far enough to see the forest floor and pans
west, which takes Cain out of frame while he's standing there. That was on purpose, but I don't know
yet whether it's annoying to actually play.
