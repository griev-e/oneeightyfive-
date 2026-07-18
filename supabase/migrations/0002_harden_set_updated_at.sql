-- Security-advisor WARN: functions should pin search_path.
-- set_updated_at only touches NEW, so an empty search_path is safe.
alter function public.set_updated_at() set search_path = '';
