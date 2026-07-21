-- Surplus 0005 — hardening + gym QoL schema.
-- Durable unlock lockout, food-AI daily budget, atomic RPCs for the two
-- read-then-write races (quick-add bump, set numbering), offline-replay
-- idempotency keys, per-exercise rest targets. Deny-all RLS throughout.

-- 1. Durable unlock brute-force state. Serverless memory resets on every
--    cold start, so the per-IP counter lives here; the route still keeps an
--    in-memory fast path and treats this table as best-effort (bootstrap
--    installs have no Supabase yet).
create table public.unlock_attempts (
  ip           text primary key check (char_length(ip) between 1 and 64),
  failures     integer not null default 0 check (failures between 0 and 100000),
  locked_until timestamptz,
  updated_at   timestamptz not null default now()
);
alter table public.unlock_attempts enable row level security;

-- 2. Food-AI daily budget: one counter row per UTC day. Caps provider spend
--    if the unlock cookie ever leaks; the cap itself is an env var.
create table public.ai_usage (
  day   date primary key,
  calls integer not null default 0 check (calls >= 0)
);
alter table public.ai_usage enable row level security;

create function public.bump_ai_usage(p_day date)
returns integer
language sql
set search_path = ''
as $$
  insert into public.ai_usage as u (day, calls) values (p_day, 1)
  on conflict (day) do update set calls = u.calls + 1
  returning calls;
$$;
revoke execute on function public.bump_ai_usage(date)
  from anon, authenticated, public;

-- 3. Atomic quick-add ranking bump — replaces the route's read-then-write
--    (two round-trips and a lost-update race). Also finally writes
--    last_used_at in the same statement.
create function public.increment_meal_use(p_meal_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.meals
     set use_count = use_count + 1, last_used_at = now()
   where id = p_meal_id;
$$;
revoke execute on function public.increment_meal_use(uuid)
  from anon, authenticated, public;

-- 4. Idempotency keys for the offline write queue. The client stamps
--    client_id into the mutation VARIABLES at mutate time; replaying a write
--    whose ACK was lost dedupes on it instead of inserting a second row.
--    Backfill via the default is fine — old rows just get unique values.
alter table public.food_logs
  add column client_id uuid not null default gen_random_uuid();
alter table public.food_logs
  add constraint food_logs_client_id_key unique (client_id);

alter table public.workout_sets
  add column client_id uuid not null default gen_random_uuid();
alter table public.workout_sets
  add constraint workout_sets_client_id_key unique (client_id);

-- 5. Atomic, idempotent set logging: assigns set_number server-side in one
--    call (numbers keep gaps — max+1, never renumber), and a replayed
--    client_id returns the existing row untouched.
create function public.log_workout_set(
  p_client_id uuid,
  p_exercise_id uuid,
  p_date date,
  p_weight_lbs numeric,
  p_reps integer,
  p_rpe numeric default null,
  p_note text default null
) returns public.workout_sets
language plpgsql
set search_path = ''
as $$
declare
  v_row public.workout_sets;
begin
  select * into v_row from public.workout_sets where client_id = p_client_id;
  if found then return v_row; end if;

  for i in 1..3 loop
    begin
      insert into public.workout_sets
          (client_id, exercise_id, date, weight_lbs, reps, rpe, note, set_number)
        values (p_client_id, p_exercise_id, p_date, p_weight_lbs, p_reps, p_rpe, p_note,
          (select coalesce(max(set_number), 0) + 1
             from public.workout_sets
            where date = p_date and exercise_id = p_exercise_id))
        returning * into v_row;
      return v_row;
    exception when unique_violation then
      -- a same-moment insert took the number, or the replay itself landed
      -- twice — if the client_id now exists, that row wins; otherwise retry
      select * into v_row from public.workout_sets where client_id = p_client_id;
      if found then return v_row; end if;
    end;
  end loop;
  raise exception 'could not assign set number';
end $$;
revoke execute on function public.log_workout_set(uuid, uuid, date, numeric, integer, numeric, text)
  from anon, authenticated, public;

-- 6. Per-exercise rest target (seconds); null = app default.
alter table public.exercises
  add column rest_seconds integer check (rest_seconds between 30 and 600);
