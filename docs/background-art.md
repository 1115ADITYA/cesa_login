# Background art

The signed-in pages render a fixed backdrop (`.ambient` in `src/app/globals.css`)
that layers, top to bottom:

1. a dark scrim — `rgba(19,15,14, .86 → .94)`
2. a rose glow at the top right, a faint blue one at the left
3. **`public/bg-ambient.jpg`** — the artwork

The scrim is doing most of the work on purpose: text contrast must never depend
on which part of the artwork happens to sit behind it. If `bg-ambient.jpg` is
missing the gradients alone still carry the page, so nothing breaks while you
are still generating it.

## What the image has to do

- **Landscape, 2560×1440 minimum** (3840×2160 if you can). Export JPG, quality
  ~80, and keep it **under 900 KB** — it loads on every page.
- **Quiet in the middle.** The content column sits dead centre at up to 72rem.
  Put the interest in the outer thirds and the top edge.
- **Dark to begin with.** It gets multiplied under an 86–94% dark scrim; a
  bright image just turns to grey mud. Aim for something already dim and moody.
- **Low contrast, no hard edges** near the centre. Faces, text and strong
  diagonals read as noise once they are dimmed.
- **Match the palette** already set by `bg-cherry.jpg` on the login screen:
  warm near-black `#130F0E`, cherry-blossom pink `#E87A8C` / `#F4A5AE`,
  muted terracotta and moss.

## Prompt — main ambient backdrop (`public/bg-ambient.jpg`)

> Wide cinematic anime-style illustration of a cherry blossom courtyard at
> night, seen from a low angle. A single old sakura tree arcs in from the
> upper-left corner, petals drifting across the frame. Distant warm paper
> lanterns glow along a stone path that fades into fog toward the horizon. The
> centre of the frame is empty sky and haze — no subject, no focal point. Deep
> warm near-black background, dusty rose and pale pink blossoms, muted
> terracotta roof tiles just visible at the edges, faint moss green undergrowth.
> Soft volumetric light, heavy atmospheric depth, gentle film grain, painterly
> Studio Ghibli meets modern anime key-visual style. Very dark, low contrast,
> moody, desaturated. 16:9 widescreen wallpaper.

**Negative / avoid:** people, faces, text, logos, watermarks, harsh highlights,
bright daylight, high saturation, busy detail in the centre, strong diagonal
lines through the middle, hard shadows, lens flare.

## Prompt — alternate, more architectural

> Wide cinematic anime illustration of a quiet university campus building at
> dusk, framed from the far left of the composition, cherry trees in bloom
> along the right edge. Empty misty air fills the centre. Warm near-black
> night palette with dusty rose and pale pink blossom accents, weathered stone
> and dark timber. Soft rim light, deep atmospheric fog, painterly anime
> key-visual style. Very dark, low contrast, no people, no text. 16:9
> widescreen wallpaper.

## Prompt — event banner (per-event `banner_url`, 3:1)

Event cards and the event page render `banner_url` at roughly 3:1, so these
want a different crop:

> Wide 3:1 banner illustration for a student tech event. Abstract dark
> composition: faint circuit traces and soft geometric shapes dissolving into
> cherry-blossom petals, lit from one side. Deep warm near-black background
> with dusty rose and pale pink accents. Minimal, atmospheric, no text, no
> people, low contrast, painterly anime style.

## After generating

Save as `public/bg-ambient.jpg`. Nothing else to wire up — `.ambient` already
points at that path. If the result still feels too loud once it is in place,
raise the two scrim stops in `.ambient` rather than re-editing the artwork.
