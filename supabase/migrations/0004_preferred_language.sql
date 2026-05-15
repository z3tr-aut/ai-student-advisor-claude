-- 0004_preferred_language.sql
-- Adds a per-user interface-language preference used by the root layout
-- (to set <html lang dir>) and by the chat route (to bias Gemini's reply language).
--
-- Values: 'en' (default) or 'ar'. Stored as text rather than an enum so future
-- locales (e.g. 'fr', 'tr') can be added without a schema migration.

alter table public.profiles
  add column if not exists preferred_language text not null default 'en';

-- Constrain to known locales for now.
alter table public.profiles
  drop constraint if exists profiles_preferred_language_check;
alter table public.profiles
  add constraint profiles_preferred_language_check
  check (preferred_language in ('en', 'ar'));

comment on column public.profiles.preferred_language is
  'Interface language preference: en | ar. Controls <html lang dir> and the Gemini reply-language default.';
