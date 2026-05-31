alter table public.marketing_campaigns
  add column if not exists external_url text;

alter table public.marketing_campaigns
  drop constraint if exists marketing_campaigns_external_url_https;

alter table public.marketing_campaigns
  add constraint marketing_campaigns_external_url_https
  check (
    external_url is null
    or external_url ~* '^https://[^[:space:]]+$'
  );
