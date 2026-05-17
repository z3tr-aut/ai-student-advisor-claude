-- 0005_last_schedule.sql
-- Stores the most recent schedule the advisor built for a user (via the
-- build_schedule chat tool) so the "My Schedule" page reflects what was just
-- requested in chat instead of always recomputing a hardcoded default.
--
-- Nullable JSON snapshot: { targetCredits, preferences, result } where result
-- is the engine's ScheduleResult. Overwritten on every build_schedule call.

alter table public.profiles
  add column if not exists last_schedule jsonb;

comment on column public.profiles.last_schedule is
  'Latest build_schedule snapshot { targetCredits, preferences, result }. Drives the My Schedule page; overwritten each build. No effect on eligibility.';
