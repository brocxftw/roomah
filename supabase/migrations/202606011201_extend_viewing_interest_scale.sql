alter table public.viewings
  drop constraint if exists viewings_interest_level_valid;

alter table public.viewings
  add constraint viewings_interest_level_valid check (
    interest_level is null
    or interest_level between 1 and 5
  );
