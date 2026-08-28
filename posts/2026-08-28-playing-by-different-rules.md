---
title: Playing by different rules
date: 2026-08-28
tags: design
summary: Combat felt wrong and I couldn't say why. It turned out Cain and the wretch were running two different rulebooks, and Cain had the worse half of every one.
---

I have been saying "the combat feels off" for about a week without being able to point at anything.
Every individual system read fine. The telegraphs were spaced, the poise ladder was there, the
shields had genuinely different windows. It still played badly, and the specific complaint I kept
landing on was that I would attack, get hit during the swing, and not feel like I had been given any
chance to do something about it.

So I stopped looking at systems and measured one number instead: **the longest stretch during which
Cain cannot reach a defensive verb.** A read only exists if

```
playerLockout + ~250ms reaction  <=  enemyWindUp
```

A wretch's fastest attack winds up in 500ms, so the honest budget is about a quarter of a second.
Here is what Cain actually had.

| weapon | longest window with no defence reachable |
|---|---|
| dagger | 0.280s |
| axe | 0.700s |
| spear | 0.770s |

The spear had a **0.77 second** unbroken window, against a 500ms attack. There was no read to miss.
There was nothing there to do.

## The roll input wasn't refused, it was discarded

Pressing roll during an attack did nothing at all. Not "was rejected" — the key was never read. The
input handler early-returns once `_isAttacking` is true, and the roll check lives below it.

It isn't buffered either. `_bufferedRollTimer` is only ever set while `_staggerTimer > 0f`. So a
roll pressed mid-swing wasn't queued for when the swing ended; it was dropped on the floor.

What makes this properly embarrassing is the comment sitting a few lines above that early return:

```
// Capture combo buffer before the early return blocks all other input
```

The attack buttons were explicitly rescued from it. The roll was left behind. The game was buffering
Cain's offence out of defensive states while discarding his defence during offensive ones, and
someone — me — wrote a comment naming the exact mechanism and then fixed one side of it.

## The combo window charged you for stopping

After every attack with a follow-up, the sequence sat in a blocking wait for `comboInputWindow`
(0.28s) with `_isAttacking` still true. No roll, no block, no parry.

The part I hadn't noticed: that wait **only ever elapsed when you pressed nothing.** The recovery
loop already bails early on a buffered combo input, so recovery was always the real window. The
extra 0.28s was a second, redundant one, and all it did was charge a defenceless third of a second
for throwing one attack and returning to neutral — which is exactly the disciplined play the rest of
the design is built to reward.

It's a pending offer held in neutral now rather than a state you're stuck inside. Cain gets every
verb back immediately, and a press within the window resumes the tree from where it stopped. Same
forgiveness, none of the lockout.

## Cain's poise was backwards

This is the one that actually explains the feeling.

```
_currentPoise -= poiseDamage;
bool poiseBroken = _currentPoise <= 0f;
...
_isAttacking  = false;                   // always
_staggerTimer = poiseBroken ? staggerDuration * 2.5f : staggerDuration;
```

Every hit cancelled his attack and staggered him. Poise picked between two stagger lengths and did
nothing else with its existence. Meanwhile the enemy rule, sitting in `EnemyBehaivoir` and working
correctly the entire time, is *"during attacks the enemy has super armor; damage lands but the
attack is not interrupted, and only a poise break can cancel it."*

Same rule for both sides now. A hit that doesn't break poise lets the swing continue — damage, gray
health, poise loss and i-frames all still land, but the blow doesn't take the attack away. That
changes the question from "could I have reacted to that?", where the mid-swing answer was often
honestly no, into "was that trade worth it?", which is a decision.

It also means `maxPoise` finally does something. The offhand's bracing bonus and the handle's
`poiseMultiplier` have been live and inert this whole time.

| | before | after |
|---|---|---|
| dagger | 0.280s | **0.152s** |
| dagger + gutting grip | 0.280s | **0.116s** |
| spear | 0.770s | **0.270s** |
| axe | 0.700s | 0.700s |

## The axe didn't change, and I think that's right

The axe commits its whole wind-up — no cancel — so none of the above touched it. For a day I treated
that as unfinished work.

Then I looked at what it was already carrying: `poiseMultiplier: 1.41` against the dagger's 1.0.
Forty-one percent more poise, on a stat that until this week bought nothing but a slightly longer
stagger. Now that's the trade. The dagger dodges out of its swing; the axe tanks through it. Poise
100 / 115 / 141 against lockouts of 0.152 / 0.270 / 0.700 is a ladder rather than three flavours of
the same weapon.

I'm not certain the axe end of it is playable yet. Seven hundred milliseconds is a long time to be
committed even with armour, and "your defence is that you don't need one" only works if the armour
is generous enough to be believed. That's a playtest question, not a maths one.

## While I was in there: the parry grace never existed

`parryGraceDuration` is authored on every enemy profile in the game. It is read by nothing.

`_parryGraceTimer` has seven assignments in `EnemyBehaivoir` and every one of them is `= 0f`,
including the one at the end of the wind-up where it should be taking the profile's value. The
decrement in `Update` was unreachable, and `CanBeParried` quietly collapsed to "only while the
wind-up bar is filling", with no tolerance whatsoever for being a frame late.

It cost the tight shields most, because the parry window is a *fraction* of wind-up:

| buckler, against a 0.5s attack | window |
|---|---|
| shipped | 85ms |
| intended | **185ms** |

Eighty-five milliseconds is five frames. The design doc sanity-checks that number as "the floor of
fair" — but that check was done without the grace it was supposed to be sitting on top of.

---

None of this is baked or properly play-tested yet; it's a week of uncommitted work I've been poking
at in Play mode, and the poise change in particular makes breaks both rarer and much harsher, which
I suspect needs another pass. What I can say is that the thing I couldn't pinpoint turned out not to
be a feel problem at all. It was an asymmetry, in three places, all pointing the same direction.
