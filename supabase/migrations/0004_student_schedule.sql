-- ═══════════════════════════════════════════════════════════════════════
--   Student schedule acceptance + chat message metadata
--
--   * student_schedule: rows the student has accepted from the advisor.
--     One row per (std_id, semester_id, schedule_id). Discarding clears
--     all rows for the student in that semester.
--   * chat_messages.metadata: jsonb column letting the chat API attach a
--     structured payload (e.g. a generated schedule) to an assistant
--     message so the client can render an inline Accept button.
-- ═══════════════════════════════════════════════════════════════════════

create table if not exists public.student_schedule (
  id uuid primary key default gen_random_uuid(),
  std_id text not null references public.std(std_id) on delete cascade,
  semester_id text not null references public.semester(semester_id) on delete cascade,
  schedule_id uuid not null references public.schedule(schedule_id) on delete cascade,
  accepted_at timestamptz not null default now(),
  unique (std_id, semester_id, schedule_id)
);

create index if not exists student_schedule_std_idx
  on public.student_schedule(std_id, semester_id);

alter table public.student_schedule enable row level security;

drop policy if exists "student_schedule_select_own" on public.student_schedule;
create policy "student_schedule_select_own" on public.student_schedule
  for select using (
    exists (select 1 from public.std s where s.std_id = student_schedule.std_id and s.auth_user_id = auth.uid())
  );

drop policy if exists "student_schedule_insert_own" on public.student_schedule;
create policy "student_schedule_insert_own" on public.student_schedule
  for insert with check (
    exists (select 1 from public.std s where s.std_id = student_schedule.std_id and s.auth_user_id = auth.uid())
  );

drop policy if exists "student_schedule_delete_own" on public.student_schedule;
create policy "student_schedule_delete_own" on public.student_schedule
  for delete using (
    exists (select 1 from public.std s where s.std_id = student_schedule.std_id and s.auth_user_id = auth.uid())
  );

-- chat_messages.metadata: structured payload attached to assistant messages
-- (e.g. schedule picks) so the client can render inline action cards.
alter table public.chat_messages
  add column if not exists metadata jsonb;
