-- ═══════════════════════════════════════════════════════════════════════
--   Table & column comments — makes Supabase schema visualizer readable.
--   Run AFTER 0002_academic.sql.
--   Paste into Supabase Dashboard → SQL Editor → New Query → Run.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Catalog group ────────────────────────────────────────────────────
comment on table public.collage      is '📚 College / faculty (e.g. IT Faculty)';
comment on table public.department   is '🏛 Department within a college';
comment on table public.major        is '🎓 Degree program (e.g. Cybersecurity, AI)';
comment on table public.plan         is '📋 Versioned study plan for a major (e.g. CYBER_V1)';
comment on table public.course       is '📖 Individual course in the catalog';
comment on table public.course_prereq is '🔗 Prerequisite edges between courses';

-- ─── Student group ────────────────────────────────────────────────────
comment on table public.std          is '🧑‍🎓 Student record — links university ID to auth user';
comment on table public.std_course   is '📝 Student course history (passed / enrolled / failed)';
comment on table public.semester     is '📅 Academic semester (past / current / future)';

-- ─── Scheduling group ─────────────────────────────────────────────────
comment on table public.schedule     is '🗓 Class section — course + instructor + room + time';
comment on table public.instructor   is '👨‍🏫 Faculty member who teaches courses';
comment on table public.room         is '🏫 Physical classroom or lab';
comment on table public.time_slot    is '⏰ Weekly recurring time block (day + start + end)';

-- ─── Auth / Chat group (existing tables) ──────────────────────────────
comment on table public.profiles     is '👤 Extended user profile (links to auth.users + std)';
comment on table public.chat_sessions is '💬 A conversation thread between student and advisor';
comment on table public.chat_messages is '✉️ Individual messages within a chat session';
comment on table public.recommendations is '⭐ AI-generated recommendations saved by the student';
comment on table public.rate_limits  is '🚦 Per-user API rate limiting counters';

-- ─── Key column comments ──────────────────────────────────────────────
comment on column public.course.semester_order  is 'Suggested semester (1–8) from the degree plan';
comment on column public.course.type            is 'required | elective | university | faculty';
comment on column public.std.auth_user_id       is 'Links to auth.users.id for RLS';
comment on column public.std_course.status      is 'enrolled | passed | failed | withdrawn';
comment on column public.semester.status        is 'past | current | future';
comment on column public.profiles.std_id        is 'Links profile to std table (set during onboarding)';
