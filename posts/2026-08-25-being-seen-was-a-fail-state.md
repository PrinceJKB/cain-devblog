---
title: Being seen was a fail state
date: 2026-08-25
tags: design
summary: I gave Cain a way to make a noise somewhere he isn't. It did nothing, for four separate reasons, and the last one was that every enemy state in the game was about him.
---

Last entry ended on a gap: Cain could be quiet, but he couldn't lie. He had no way to make a noise
somewhere he wasn't standing. So I built one — a world noise channel that anything can publish into,
and a stone to throw. It travels 8 units, lands with a 9-unit noise, and does **zero damage**, which
is deliberate: a distraction tool that also kills gets used as a weapon, and then the interesting
question — fight this, or move it? — never gets asked.

Then I threw it at a wretch and nothing happened. It walked over to the noise. That was all. I still
had to walk up and start the same fight I would have started anyway.

Four things turned out to be wrong, and they were four different layers of the same mistake.

## The ground was blocking the sound

Hearing does a raycast from the listener's ear to the source, which was added a while back to stop
wolves hearing Cain through the treehouse floorboards. That ray ran 0.1 units above the ground.

A tile is *also* 0.1 units. The ray sat at exactly one tile height, so a single step of ordinary
undulation between the listener and the noise silenced it completely. Distractions only worked on
perfectly flat floor, which the Wake mostly isn't.

It samples two heights now — 0.55 and 1.4 — and the sound gets through if either is clear. Real
sound diffracts over small obstacles and only a real barrier stops it. A deck or a wall still blocks
both rays, so the floorboards case that motivated the raycast in the first place still behaves.

## The distraction made them harder to sneak past

An enemy at Suspicious or above gets a 180° vision cone instead of its normal arc, because something
actively looking for you should be hard to flank. Investigating a noise raised them to Suspicious.

So throwing a stone granted the target omnidirectional vision. The tool for creating an opening was
closing one.

There's a distinction I hadn't made: being *curious* and being *wary* are not the same state. A
creature that heard a clatter is focused on the clatter. A creature that heard **you** is hunting.
Curiosity now keeps the normal vision cone; only genuine evidence of Cain widens it.

## The payoff was explicitly locked out

```
IsBackstabbable => _isAttacking || currentState == State.Stunned
               || _alertLevel == AlertLevel.Unaware;
```

A distracted enemy is Suspicious. So the one reward that would have justified the whole sequence —
walking up behind the thing while it stares at a rock — was refused by the very state the
distraction creates. Curious enemies are backstabbable now. Wary ones still aren't.

## Everything in the game was about Cain

The last one is the real one. Here were the enemy states:

> Idle, Patrolling, Investigating, Chasing, Kiting, Attacking, Casting, Stunned, Vulnerable, Dead,
> Noticing

Investigating, Chasing, Kiting, Attacking, Casting and Noticing are all *about Cain*. Stunned,
Vulnerable and Dead are things Cain did *to them*. That leaves standing still, and walking a line.

There was no state in which a creature was doing something of its own. So every system I built fed
into one pipe that ended at the player's face. Fire damaged them, so they aggroed. Noise moved them,
so they investigated, found Cain, and aggroed. Different inputs, one output.

The model was: **see Cain, hunt Cain.** Every creature in the world was a sentry posted against the
player, and being seen was a fail state. That isn't the game — Cain is an intruder in someone else's
space, not the thing they were all waiting for.

So creatures have a temperament now:

| | |
|---|---|
| **Territorial** | Notices him, watches him, turns hostile only when he comes inside its personal space. The Wake's default. |
| **Predatory** | Hunts on sight. |
| **Skittish** | Leaves. |
| **Indifferent** | Doesn't care until something hurts it. |

Only four things are Predatory: the marrow wolf, the blind wretch, the stump, and the brute. It's
worth less the more it gets used — if everything hunts you, nothing is frightening.

Territorial creatures got a new state, `Watching`, which is the first state in the game that isn't
about attacking. They stand off and stare, drifting slightly around where they stopped while keeping
their eyes on him, and escalate when he crosses 2.2 units. Back off and stay out of sight and they
lose interest and go back to what they were doing.

The drifting is there because they looked wrong standing still. Nothing alive holds a pose, and a
frozen sprite reads as a bug rather than as menace.

Sight ranges came down about 30% across the board at the same time, because being watched from a
distance only works if the distance is real.

| | before | after |
|---|---|---|
| basic wretch | 2.40 | 1.68 |
| brute | 2.27 | 1.59 |
| stump | 2.50 | 1.75 |
| husk | 3.00 | 2.10 |
| forest wretch | 3.20 | 2.24 |
| marrow wolf | 3.20 | 2.24 |
| lasher | 3.60 | 2.52 |
| shooter | 4.84 | 3.39 |

## Three smaller things

**Burning things run.** Anything on fire breaks off whatever it was doing and panics until it's out.
Nothing fights while burning to death — and because it's still alight while it runs, it carries the
fire with it. It also screams, through the same noise channel, so its packmates converge on *it*
rather than on Cain.

**The first enemy in the game was deaf.** The husk's profile had `hearingMultiplier: 0`. It's the
first thing a player meets, in Nod, and no thrown object would ever have worked on it — which makes
the region's entire sound vocabulary unteachable at exactly the point you'd want to teach it. It has
ears now (0.8, still dull).

**A poise break was spending its own reward.** The combo auto-cancelled into the riposte the instant
an enemy became vulnerable, with no input at all. The swing that earned the opening also took it,
before you'd registered that it happened. It ends the combo now and clears buffered input, and you
press again if you want it. A punish you don't choose is an animation, not a punish.

## Still open

**PROPOSED** — the fire system got rebuilt underneath all of this and it's a whole entry of its own,
so it isn't in here. Short version: authoring a burnable prop is one bool and one slider, and
everything else — burn duration, spread reach and pace, noise, light, damage — derives from the
object's size.

**OPEN** — none of this has been shown to produce a *moment*. Distraction works now in the sense
that all four bugs are gone, but the room I've been testing in is flat ground with one enemy and
nothing behind it. That room asks no question, so there's no answer the toolkit can give that isn't
"walk up and swing". Moving an enemy is only worth doing if it buys you something, and there's
nothing in that room worth buying.

I think that's the next thing, and it isn't more systems. It's one room with a stated job.

**OPEN** — the cave-corner question from last entry is still open, and I didn't fix it. The
two-height sample handles ground undulation, not walls, so chambers underground are still
acoustically sealed. That may well be wrong for caves specifically. I still don't think I can judge
it from a description.
