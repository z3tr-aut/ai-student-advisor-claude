-- ═══════════════════════════════════════════════════════════════════════
--   Academic schema — IT Faculty (Aqaba University of Technology)
--   Run AFTER supabase/schema.sql has been applied.
--   Paste into Supabase Dashboard → SQL Editor → New Query → Run.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Catalog: collage → department → major → plan ──────────────────
create table if not exists public.collage (
  collage_id text primary key,
  collage_na text not null
);

create table if not exists public.department (
  department_id text primary key,
  department_na text not null,
  collage_id text not null references public.collage(collage_id) on delete cascade
);

create table if not exists public.major (
  major_id text primary key,
  major_na text not null,
  credit_hours int not null,                        -- total hours required to graduate
  department_id text not null references public.department(department_id) on delete cascade
);

create table if not exists public.plan (
  plan_id text primary key,
  major_id text not null references public.major(major_id) on delete cascade,
  name text not null,
  version_year int
);

-- ─── 2. Courses + prerequisites ────────────────────────────────────────
create table if not exists public.course (
  course_id text primary key,                        -- e.g. '2110104'
  course_na text not null,
  credit_hours int not null,
  type text not null check (type in ('required','elective','university','faculty')),
  major_id text references public.major(major_id) on delete set null,
  plan_id text references public.plan(plan_id) on delete set null,
  semester_order int                                 -- 1..8 suggested by the plan
);

create index if not exists course_plan_idx on public.course(plan_id, semester_order);

-- ER diagram shows a single prereq_id on `course`, but real plans have ≥1 prereq.
-- We normalize into a join table.
create table if not exists public.course_prereq (
  course_id text not null references public.course(course_id) on delete cascade,
  prereq_course_id text not null references public.course(course_id) on delete cascade,
  primary key (course_id, prereq_course_id)
);

-- ─── 3. Students ───────────────────────────────────────────────────────
create table if not exists public.std (
  std_id text primary key,                           -- university ID
  std_na text not null,
  major_id text references public.major(major_id) on delete set null,
  plan_id text references public.plan(plan_id) on delete set null,
  auth_user_id uuid unique references auth.users(id) on delete cascade
);

create index if not exists std_auth_user_idx on public.std(auth_user_id);

-- Bridge profiles → std (coexistence with existing schema)
alter table public.profiles
  add column if not exists std_id text references public.std(std_id) on delete set null;

-- ─── 4. Semesters & student coursework history ─────────────────────────
create table if not exists public.semester (
  semester_id text primary key,                      -- e.g. 'F2024'
  name text not null,
  s_date date,
  e_date date,
  status text not null check (status in ('past','current','future'))
);

create table if not exists public.std_course (
  history_id uuid primary key default gen_random_uuid(),
  std_id text not null references public.std(std_id) on delete cascade,
  course_id text not null references public.course(course_id) on delete cascade,
  semester_id text references public.semester(semester_id) on delete set null,
  grade numeric,
  status text not null check (status in ('enrolled','passed','failed','withdrawn')),
  section text
);

create index if not exists std_course_std_idx on public.std_course(std_id, status);
create unique index if not exists std_course_unique_pass
  on public.std_course(std_id, course_id)
  where status = 'passed';

-- ─── 5. Scheduling entities ────────────────────────────────────────────
create table if not exists public.instructor (
  instructor_id text primary key,
  instructor_name text not null,
  spec text,
  degree_type text
);

create table if not exists public.room (
  room_id text primary key,
  building text,
  capacity int,
  type text
);

create table if not exists public.time_slot (
  time_id text primary key,
  day int not null check (day between 0 and 6),     -- 0 = Sunday
  s_time time not null,
  e_time time not null
);

create table if not exists public.schedule (
  schedule_id uuid primary key default gen_random_uuid(),
  room_id text references public.room(room_id) on delete set null,
  time_id text references public.time_slot(time_id) on delete set null,
  course_id text not null references public.course(course_id) on delete cascade,
  instructor_id text references public.instructor(instructor_id) on delete set null,
  semester_id text references public.semester(semester_id) on delete cascade
);

-- ═══════════════════════════════════════════════════════════════════════
--   ROW LEVEL SECURITY
--   Catalog tables: readable by any authenticated user, admin writes only.
--   Student-specific tables: owner-only via auth_user_id linkage.
-- ═══════════════════════════════════════════════════════════════════════

alter table public.collage       enable row level security;
alter table public.department    enable row level security;
alter table public.major         enable row level security;
alter table public.plan          enable row level security;
alter table public.course        enable row level security;
alter table public.course_prereq enable row level security;
alter table public.std           enable row level security;
alter table public.semester      enable row level security;
alter table public.std_course    enable row level security;
alter table public.instructor    enable row level security;
alter table public.room          enable row level security;
alter table public.time_slot     enable row level security;
alter table public.schedule      enable row level security;

-- Catalog read policies (all authenticated users can read)
do $$
declare t text;
begin
  foreach t in array array[
    'collage','department','major','plan','course','course_prereq',
    'semester','instructor','room','time_slot','schedule'
  ] loop
    execute format('drop policy if exists "%s_read_all" on public.%I;', t, t);
    execute format(
      'create policy "%s_read_all" on public.%I for select to authenticated using (true);',
      t, t
    );
  end loop;
end $$;

-- std: user sees their own row
drop policy if exists "std_select_own" on public.std;
create policy "std_select_own" on public.std
  for select using (auth.uid() = auth_user_id);

drop policy if exists "std_insert_own" on public.std;
create policy "std_insert_own" on public.std
  for insert with check (auth.uid() = auth_user_id);

drop policy if exists "std_update_own" on public.std;
create policy "std_update_own" on public.std
  for update using (auth.uid() = auth_user_id);

-- std_course: user sees their own history (via std linkage)
drop policy if exists "std_course_select_own" on public.std_course;
create policy "std_course_select_own" on public.std_course
  for select using (
    exists (select 1 from public.std s where s.std_id = std_course.std_id and s.auth_user_id = auth.uid())
  );

drop policy if exists "std_course_insert_own" on public.std_course;
create policy "std_course_insert_own" on public.std_course
  for insert with check (
    exists (select 1 from public.std s where s.std_id = std_course.std_id and s.auth_user_id = auth.uid())
  );

drop policy if exists "std_course_update_own" on public.std_course;
create policy "std_course_update_own" on public.std_course
  for update using (
    exists (select 1 from public.std s where s.std_id = std_course.std_id and s.auth_user_id = auth.uid())
  );

drop policy if exists "std_course_delete_own" on public.std_course;
create policy "std_course_delete_own" on public.std_course
  for delete using (
    exists (select 1 from public.std s where s.std_id = std_course.std_id and s.auth_user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════
--   Done. Verify with:
--     select table_name from information_schema.tables
--     where table_schema = 'public' order by table_name;
-- ═══════════════════════════════════════════════════════════════════════
