-- Two things an admin could not control before.
--
-- 1. banner_position — which part of a banner stays visible when it is cropped
--    to a card or thumbnail, instead of every crop defaulting to dead-centre
--    (which cut the prize text off a portrait poster like CODECADE's). Stored
--    as a CSS object-position value ("62% 20%") rather than separate x/y
--    columns: written once by BannerUpload.tsx, read once by every
--    <img style={{objectPosition}}> — no reason to split and rejoin it.
--
-- 2. poster_url — the full event poster, shown uncropped in a 9:16 panel beside
--    the registration form. Deliberately a separate column from banner_url:
--    the banner is a wide crop for cards, the poster is the portrait artwork
--    carrying prizes/venue/rules that a registrant needs to read. Same image
--    cannot serve both without ruining one of them.
--
-- Idempotent.

alter table public.events add column if not exists banner_position text not null default '50% 50%';
alter table public.events add column if not exists poster_url text;
