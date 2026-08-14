---
title: Nine rooms west
date: 2026-06-06
tags: design, lore
summary: Planning Nod, the opening region — flat, quiet, sparse, and deliberately not a combat area.
---

Nod is the first thing anyone will play, and I've been putting off building it properly because
the placeholder chain works well enough to walk through. That's exactly why it needed a plan on
paper before I touch it again.

The brief is four words: **flat, quiet, sparse, heavy.** Long sightlines, wind, footsteps. A five
to eight minute walk westward. **PROPOSED** as a region that contains a grand total of one enemy.

## The chain

Nine rooms, east to west. Every run starts at Cain's shack and ends at the monument.

| # | Room | Beat |
|---|------|------|
| 1 | **CainsShackRoom** | Where every run begins. The shack landmark is done. |
| 2 | NodFields_A | First step outside. The longest sightline I can give it. No enemies. |
| 3 | NodWretchHollow | The Lone Wretch. A shallow, readable depression — the tutorial arena. |
| 4 | NodFields_B | Emptiness after violence. Wind and one ruined fence-line. |
| 5 | NodOldField | Something was worked here once. A half-sunk well or foundation. |
| 6 | NodRise | The one elevation in Nod. From the crest, the monument owns the skyline. |
| 7 | NodQuiet | The oldest, emptiest place. Sparser than Fields_B. |
| 8 | NodApproach | Old stones thicken westward. The ground rises toward it. |
| 9 | **NodMonument** | Cain's Monument. The largest cairn in the game, built over millennia. |

The current region asset already has the nine nodes wired in the right order, but it's built from
three placeholder rooms repeated. The plan is to replace them one at a time, east to west, keeping
the door wiring intact and just swapping each node's room reference as the real one is ready. That
way the region is always walkable, and I never have a week where the game doesn't run.

## The hollow is the whole tutorial

Room 3 is the only room with an enemy in it, and it's doing a lot of work. A shallow depression,
three or four tiles deep, with a wide flat floor and one leaning dead tree on the lip so you can
read it from a room away.

The important part is that **the rim is skirtable.** A new player drops in and fights. A veteran on
their fortieth run walks straight past along the edge in about four seconds. I don't want a tutorial
that taxes people who already know the game — the hollow teaches by being optional.

## Dials I already know are wrong

Two things are set for a region that Nod isn't:

- **Mist density is 0.62.** That reads as heavy, and Nod is supposed to read as *quiet*. Dropping
  toward 0.4 with wind influence at 1 so the wind is actually visible in it.
- **Foreground occluders need to go to near zero.** Occluders fight long sightlines, and the long
  sightline is the entire point of the region.

Trees should be rare, dry grass everywhere, and the distant treeline band kept low — Nod's horizon
should be mostly empty sky.

## The locked door

The west door out of NodMonument is locked, and stays locked until region transitions exist. Which
means for now the opening region ends by walking up to the biggest object in the game and not being
able to go past it.

I'm not sure yet whether that's frustrating or exactly right.
