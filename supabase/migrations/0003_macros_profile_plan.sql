-- Surplus 0003 — macros (carbs/fat), profile + questionnaire, target history,
-- plan events, atomic plan application. Deny-all RLS, secret-key only.

-- 1. Macro columns: snapshot-copied into logs exactly like calories/protein.
alter table public.meals
  add column carbs_g integer not null default 0 check (carbs_g between 0 and 1000),
  add column fat_g   integer not null default 0 check (fat_g   between 0 and 500);

alter table public.food_logs
  add column carbs_g integer not null default 0 check (carbs_g between 0 and 1000),
  add column fat_g   integer not null default 0 check (fat_g   between 0 and 500);

-- 2. Settings: carb/fat targets (derived from the existing 2700/135 plan:
--    fat 80 g = 720 kcal, carbs (2700-540-720)/4 = 360 g) + rate provenance.
--    Rate ceiling tightened to the real invariant (1.00 lb/wk).
alter table public.settings
  add column carb_target_g integer not null default 360 check (carb_target_g between 50 and 1200),
  add column fat_target_g  integer not null default 80  check (fat_target_g  between 20 and 400),
  add column goal_rate_source text not null default 'recommended'
    check (goal_rate_source in ('recommended','custom'));
alter table public.settings
  drop constraint settings_goal_rate_lbs_per_week_check,
  add constraint settings_goal_rate_lbs_per_week_check
    check (goal_rate_lbs_per_week between 0.00 and 1.00);

-- 3. profile: questionnaire answers (inputs). Singleton like settings.
create table public.profile (
  id                     smallint primary key default 1 check (id = 1),
  name                   text not null default 'kevin' check (char_length(name) between 1 and 40),
  sex                    text not null default 'male' check (sex in ('male','female')),
  birth_date             date,
  height_in              numeric(4,1) check (height_in between 55 and 90),
  body_fat_pct           numeric(4,1) check (body_fat_pct between 3 and 60), -- null = "not sure"
  neat_tier              text check (neat_tier in ('sitting','light','active','demanding')),
  lift_days_per_week     smallint check (lift_days_per_week between 2 and 6),
  session_min            smallint check (session_min in (45, 60, 75, 90)),
  cardio_min_per_week    smallint check (cardio_min_per_week in (0, 60, 120, 180)),
  training_months        integer check (training_months between 0 and 600),
  training_months_as_of  date,
  appetite               text check (appetite in ('easy','manageable','struggle')),
  bulk_style             text check (bulk_style in ('lean','standard','aggressive')),
  completed_at           timestamptz,          -- null = questionnaire never finished
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger profile_updated_at before update on public.profile
  for each row execute function public.set_updated_at();
insert into public.profile (id, name) values (1, 'kevin');

-- 4. target_history: the target in force per app-day. One row per day;
--    same-day change upserts (a day is judged once, at close, vs its final
--    target). Deliberately NOT seeded here: current_date is UTC and must
--    never guess the local app-day — the first apply_targets call (always
--    client-dated) owns the first row, and streak math falls back to
--    current settings when no row precedes a date.
create table public.target_history (
  effective_date   date primary key,
  calorie_target   integer not null check (calorie_target between 1000 and 10000),
  protein_target_g integer not null check (protein_target_g between 30 and 500),
  carb_target_g    integer not null check (carb_target_g between 50 and 1200),
  fat_target_g     integer not null check (fat_target_g between 20 and 400),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger target_history_updated_at before update on public.target_history
  for each row execute function public.set_updated_at();

-- 5. plan_events: append-only audit + the recalibration cadence clock.
create table public.plan_events (
  id               uuid primary key default gen_random_uuid(),
  date             date not null,               -- client-supplied app-day
  action           text not null check (action in ('applied','dismissed','questionnaire')),
  observed_tdee    integer,
  target_before    integer,
  target_suggested integer,
  created_at       timestamptz not null default now()
);

-- 6. Atomic application: settings + target_history (+ plan_events when the
--    calorie target actually changed, or on questionnaire completion).
--    p_effective_date comes from the CLIENT (getAppDate() — server is UTC).
create function public.apply_targets(
  p_effective_date date,
  p_calorie_target integer,
  p_protein_target_g integer,
  p_carb_target_g integer,
  p_fat_target_g integer,
  p_goal_rate_lbs_per_week numeric default null,
  p_goal_weight_lbs numeric default null,
  p_goal_rate_source text default null,
  p_action text default 'applied',
  p_observed_tdee integer default null
) returns void
language plpgsql
set search_path = ''
as $$
declare
  v_target_before integer;
begin
  select calorie_target into v_target_before from public.settings where id = 1;

  update public.settings set
    calorie_target         = p_calorie_target,
    protein_target_g       = p_protein_target_g,
    carb_target_g          = p_carb_target_g,
    fat_target_g           = p_fat_target_g,
    goal_rate_lbs_per_week = coalesce(p_goal_rate_lbs_per_week, goal_rate_lbs_per_week),
    goal_weight_lbs        = coalesce(p_goal_weight_lbs, goal_weight_lbs),
    goal_rate_source       = coalesce(p_goal_rate_source, goal_rate_source)
  where id = 1;

  insert into public.target_history
      (effective_date, calorie_target, protein_target_g, carb_target_g, fat_target_g)
    values (p_effective_date, p_calorie_target, p_protein_target_g,
            p_carb_target_g, p_fat_target_g)
    on conflict (effective_date) do update set
      calorie_target   = excluded.calorie_target,
      protein_target_g = excluded.protein_target_g,
      carb_target_g    = excluded.carb_target_g,
      fat_target_g     = excluded.fat_target_g;

  -- an event only when something actually happened (or a questionnaire ran):
  -- editing goal weight alone must not silence the recalibration clock.
  if v_target_before is distinct from p_calorie_target or p_action = 'questionnaire' then
    insert into public.plan_events (date, action, observed_tdee, target_before, target_suggested)
      values (p_effective_date, p_action, p_observed_tdee, v_target_before, p_calorie_target);
  end if;
end $$;

-- PostgREST default grants would let anon *call* the RPC (RLS makes it fail,
-- but it shouldn't even be callable).
revoke execute on function public.apply_targets(
  date, integer, integer, integer, integer, numeric, numeric, text, text, integer
) from anon, authenticated, public;

-- 7. RLS: deny-all, same as every other table.
alter table public.profile        enable row level security;
alter table public.target_history enable row level security;
alter table public.plan_events    enable row level security;
