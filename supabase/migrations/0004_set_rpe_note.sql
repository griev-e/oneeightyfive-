-- Surplus 0004 — optional per-set effort (RPE) + note.
-- Nullable on purpose: absence means "not recorded", never 0.
-- numeric(3,1) so half-points (8.5) work; RPE below 5 isn't worth logging.
alter table public.workout_sets
  add column rpe  numeric(3,1) check (rpe between 5 and 10),
  add column note text check (char_length(note) <= 200);
