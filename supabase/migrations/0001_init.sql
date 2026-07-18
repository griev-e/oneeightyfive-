-- Surplus 0001_init — single-user schema, PIN-gated app.
-- All access goes through the Next.js server using the secret key; RLS is
-- enabled on every table with NO policies, so publishable/anon keys can
-- read and write nothing. No user_id columns — there is exactly one user.

create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- settings: a true singleton row
create table public.settings (
  id                     smallint primary key default 1 check (id = 1),
  calorie_target         integer not null default 2700 check (calorie_target between 1000 and 10000),
  protein_target_g       integer not null default 135 check (protein_target_g between 30 and 500),
  goal_rate_lbs_per_week numeric(3,2) not null default 0.50 check (goal_rate_lbs_per_week between 0.10 and 2.00),
  goal_weight_lbs        numeric(5,1) check (goal_weight_lbs between 80 and 400),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- weigh_ins: one per app-day; re-entry upserts
create table public.weigh_ins (
  date        date primary key,
  weight_lbs  numeric(5,1) not null check (weight_lbs between 50 and 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger weigh_ins_updated_at before update on public.weigh_ins
  for each row execute function public.set_updated_at();

-- meals: saved/reusable; archived, never deleted (logs snapshot them anyway)
create table public.meals (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 1 and 80),
  calories     integer not null check (calories between 0 and 5000),
  protein_g    integer not null default 0 check (protein_g between 0 and 500),
  use_count    integer not null default 0,
  last_used_at timestamptz,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index meals_quick_add on public.meals (archived_at, use_count desc);
create trigger meals_updated_at before update on public.meals
  for each row execute function public.set_updated_at();

-- food_logs: snapshot-copy of calories/protein; meal_id is provenance only
create table public.food_logs (
  id         uuid primary key default gen_random_uuid(),
  date       date not null,
  meal_id    uuid references public.meals(id) on delete set null,
  name       text not null default 'Quick add' check (char_length(name) <= 80),
  calories   integer not null check (calories between 0 and 5000),
  protein_g  integer not null default 0 check (protein_g between 0 and 500),
  logged_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index food_logs_by_day on public.food_logs (date desc, logged_at);
create trigger food_logs_updated_at before update on public.food_logs
  for each row execute function public.set_updated_at();

-- exercises: seeded compounds + user-added
create table public.exercises (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 60),
  is_seeded   boolean not null default false,
  sort_order  smallint not null default 100,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index exercises_unique_name on public.exercises (lower(name));
create index exercises_picker on public.exercises (archived_at, sort_order, name);
create trigger exercises_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

-- workout_sets: flat sets; sessions are derived (same date + exercise)
create table public.workout_sets (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  weight_lbs  numeric(5,1) not null check (weight_lbs between 0 and 1500), -- 0 = bodyweight
  reps        smallint not null check (reps between 1 and 100),
  set_number  smallint not null check (set_number between 1 and 50),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (date, exercise_id, set_number)
);
create index workout_sets_last_session on public.workout_sets (exercise_id, date desc, set_number);
create index workout_sets_by_day on public.workout_sets (date desc);
create trigger workout_sets_updated_at before update on public.workout_sets
  for each row execute function public.set_updated_at();

-- seed: settings singleton + starter compound lifts
insert into public.settings (id, goal_weight_lbs) values (1, 185);

insert into public.exercises (name, is_seeded, sort_order) values
  ('Barbell Bench Press', true, 10),
  ('Barbell Back Squat',  true, 20),
  ('Deadlift',            true, 30),
  ('Overhead Press',      true, 40),
  ('Barbell Row',         true, 50),
  ('Pull-Up',             true, 60),
  ('Chin-Up',             true, 61),
  ('Incline Dumbbell Press', true, 70),
  ('Dumbbell Row',        true, 80),
  ('Romanian Deadlift',   true, 90),
  ('Lat Pulldown',        true, 91),
  ('Dip',                 true, 92),
  ('Dumbbell Curl',       true, 93),
  ('Lateral Raise',       true, 94);

-- RLS: enabled everywhere, zero policies — anon/publishable keys get nothing.
alter table public.settings     enable row level security;
alter table public.weigh_ins    enable row level security;
alter table public.meals        enable row level security;
alter table public.food_logs    enable row level security;
alter table public.exercises    enable row level security;
alter table public.workout_sets enable row level security;
