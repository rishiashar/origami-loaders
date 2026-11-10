---
name: fold
description: Fold origami models into live, animated 3D paper with the origami-loaders engine. Writes a new model one fold at a time (a traditional model such as a tulip, cup, jumping frog or crane, or the user's own design described in words), checks that the paper behaves like paper, looks at every step, and ships it as an <origami-loader> loading animation and as an <origami-lesson> step-by-step lesson page that teaches the fold. Use this whenever someone wants an origami or paper-folding animation, loader or spinner, wants to teach or show how an origami model is folded (for a class, for kids, a tutorial, a video, or a help page), wants a new model for origami-loaders, or types /fold, even if they never say "skill" or "origami-loaders".
---

# Fold

**Every fold is one a hand can make.** A model here is not a picture of the finished shape. It is the folding itself, written down one step at a time against the paper as it lies, the way a diagram teaches it. The loader plays those steps and the lesson teaches them. A step real paper can't make is a lie in the animation, and in a lesson it strands the person folding along: a child gets stuck at step 6 and gives up. So truth comes first and looks second.

## What you make

One model file gives both:

- **A loader**: `registerModel('tulip', buildTulip)`, then `<origami-loader model="tulip">` in any page or framework.
- **A lesson**: `<origami-lesson model="tulip">` in their app, or a standalone lesson page (one HTML file that opens offline) for a teacher, a parent or anyone to share.

The model file is the hard part; both outputs are cheap once it exists. Make both unless the person only wants one.

## Which models

- **Traditional models**, folded the same way for generations (crane, jumping frog, boat, cup, tulip, fox, dog, cat, fortune teller, balloon, ...). Follow a public diagram.
- **The person's own designs.** They describe it in words, a photo of their diagram or a crease pattern. Follow it exactly, and ask about anything the description leaves open instead of guessing.
- **Not models by named modern designers** (Robert Lang, Satoshi Kamiya, John Montroll, Tomoko Fuse and the like). Their designs and diagrams are their work, and animating a diagram step by step copies it. Say so plainly and kindly, and offer the nearest traditional model. If the person is the designer, or has the designer's permission, they can say so and you can go ahead.

## Size it first

Before writing anything, say which size it is and roughly how long it takes:

| Size | What it holds | Time |
| --- | --- | --- |
| **Simple** | Up to about 8 steps of valley and mountain folds, unfolds and turning over: cup, boat, heart, fox or dog face, envelope, plane | 15–45 min |
| **Classic** | Bases (square, waterbomb, fish), petal, squash and reverse folds, 10–30 steps: crane, jumping frog, swan, whale | 1–4 h |
| **Out of reach** | Sinks, crimps, curved or 3D-shaped paper, boxes and modular models, tessellations, wet-folding | — |

A **simple** model: just build it. A **classic** model: say so first, write the step list (step 1 below) and ask the person to confirm it before writing code; this is where a human catches a wrong step for free. **Out of reach**: say what the engine can't fold and offer the nearest simple or classic model. Don't approximate a sink with something that looks close; the lesson would teach the wrong fold.

## How to fold one

1. **Truth first: the diagram and the step list.** For a traditional model, read a public diagram (origami.me, origami-instructions.com and origami-resource-center.com have good ones). If a site you need is blocked, ask for it to be unblocked rather than working from memory. Then write the steps in words, before any code:
   - the paper: square or rectangle (which ratio), which side is coloured, which side faces up at the start (most models start white side up, so folds bring the colour out);
   - every step: the diagram's number, the instruction as a teacher would say it ("Fold the bottom corner up to the top edge"), and where its fold line runs, worked out from the paper's geometry (midpoints, edges onto lines, 22.5° angles, intersections), never eyeballed;
   - which steps turn the paper over, and which unfold.

   This list is the source of truth: the labels become the lesson's instructions, word for word.
2. **A project to fold in.** The model runs in a project that has origami-loaders 0.2.0 or later. In their app, `npm i origami-loaders`. With no app (a teacher or a parent), make a folder: `npm init -y && npm pkg set type=module && npm i origami-loaders`. The model goes in `origami/<name>.ts` (or `.js`).
3. **Write the model.** Read `references/engine.md` first; it covers the coordinates, the fold call and every way to move paper. Start from the closest example in `examples/`. They are the package's ten models, ready to run in a project: `boat`, `heart`, `fox` and `envelope` for simple folds, `plane` for a rectangle, `frog`, `swan`, `whale` and `crane` for bases, squash folds and reverse folds. Write one file whose only imports are from `'origami-loaders'`, with one exported `build<Name>()` that returns `F.compile()`, and one `F.step` per step of your list, carrying its diagram number and label.
4. **Check it.** Run `node <this skill's directory>/scripts/check.mjs origami/<name>.ts`. It runs the fold check and prints the steps the lesson will teach. Fix every issue; `references/check.md` says what each one means and how it is usually fixed. Never make an issue go away by loosening the check or hiding it in another step: make the paper do what paper does.
5. **Look at it.** Run `node <this skill's directory>/scripts/lesson.mjs origami/<name>.ts --name <name> --out out/<name>-lesson.html --frames out/frames`, then open `out/frames/contact-sheet.png`. It shows every step half-folded and folded. Compare each with the diagram:
   - the right side of the paper shows (coloured or white);
   - each flap is where the diagram puts it;
   - the model stays in the frame at a good size;
   - the finished shape reads as the thing it is.

   A model can pass the check and still be wrong: a fold on the wrong line is perfectly good paper. Open a single frame (`step-07-done.png`) when something is unclear. Repeat steps 4 and 5 until every step matches the diagram.
6. **Deliver.** `references/deliver.md` has the loader and lesson snippets for plain HTML, React, Vue and Svelte, the standalone page, and how to match the person's colours.

The frames step needs Playwright (`npm i -D playwright && npx playwright install chromium`). If it can't be installed, say that you checked the paper but couldn't look at it, and ask the person to open the lesson page and step through it.

## When you finish

Say what you made (the files), the model's size, the diagram you followed (with its link), and what you checked: the fold check passed, and you looked at every step on the contact sheet. Name anything you are unsure of, for example a step the diagram left ambiguous. For a lesson, ask the person to fold the model by hand once, following the lesson, before sharing it, above all with children. The check knows paper; it doesn't know origami.

## What the engine can and can't fold

It folds flat paper: valley and mountain folds, unfolds, turning over, collapsing into a base (several creases solved together so the paper never tears), petal folds, squash folds worked out exactly, and inside and outside reverse folds, with the layers spreading the way real paper flexes. It can't sink, crimp, curve, shape in 3D, cut or glue. The fold check catches the wrong side or layer showing, folds that undo themselves and creases that come apart. It doesn't catch a fold on the wrong line, a missing step or a model that is folded right but posed off screen. That is what step 5 is for.
