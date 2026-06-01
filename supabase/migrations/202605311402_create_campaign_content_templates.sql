create type public.campaign_content_template_format as enum (
  'Caption',
  'WhatsApp',
  'Email',
  'Ad Copy',
  'SMS'
);

create type public.campaign_content_template_channel as enum (
  'Facebook',
  'Instagram',
  'TikTok',
  'Threads',
  'Google',
  'WhatsApp',
  'Email',
  'SMS',
  'Other'
);

create table public.campaign_content_templates (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,
  name text not null,
  channel public.campaign_content_template_channel not null,
  format public.campaign_content_template_format not null,
  body text not null,
  placeholders text[] not null default '{}',
  is_starter boolean not null default false,
  created_by uuid references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_content_templates_name_not_blank check (btrim(name) <> ''),
  constraint campaign_content_templates_body_not_blank check (btrim(body) <> ''),
  constraint campaign_content_templates_starter_scope check (
    (is_starter and team_id is null and created_by is null)
    or (not is_starter and team_id is not null and created_by is not null)
  )
);

create index campaign_content_templates_owner_idx
  on public.campaign_content_templates(team_id, created_by);

create index campaign_content_templates_starter_idx
  on public.campaign_content_templates(is_starter);

alter table public.campaign_content_templates enable row level security;

create policy campaign_content_templates_select_starter_or_owner
on public.campaign_content_templates
for select
using (
  is_starter
  or (
    team_id = public.jwt_team_id()
    and created_by = public.current_app_user_id()
  )
);

create policy campaign_content_templates_insert_owner_only
on public.campaign_content_templates
for insert
with check (
  not is_starter
  and team_id = public.jwt_team_id()
  and created_by = public.current_app_user_id()
);

create policy campaign_content_templates_update_owner_only
on public.campaign_content_templates
for update
using (
  not is_starter
  and team_id = public.jwt_team_id()
  and created_by = public.current_app_user_id()
)
with check (
  not is_starter
  and team_id = public.jwt_team_id()
  and created_by = public.current_app_user_id()
);

create policy campaign_content_templates_delete_owner_only
on public.campaign_content_templates
for delete
using (
  not is_starter
  and team_id = public.jwt_team_id()
  and created_by = public.current_app_user_id()
);

insert into public.campaign_content_templates (
  name,
  channel,
  format,
  body,
  placeholders,
  is_starter
) values
  (
    'Instagram Property Caption',
    'Instagram',
    'Caption',
    'New listing: {{property_name}} in {{location}}. {{listing_type}} opportunity from {{price}}. Message me for viewing details.',
    array['property_name', 'location', 'listing_type', 'price'],
    true
  ),
  (
    'WhatsApp Viewing Invite',
    'WhatsApp',
    'WhatsApp',
    'Hi, I have a property you may like: {{property_name}} at {{location}}. It is available for {{listing_type}} at {{price}}. Would you like to arrange a viewing?',
    array['property_name', 'location', 'listing_type', 'price'],
    true
  ),
  (
    'Facebook Ad Copy',
    'Facebook',
    'Ad Copy',
    'Looking for your next home or investment? Explore {{property_name}}, a {{property_type}} in {{location}} available for {{listing_type}}. Price: {{price}}. Contact us today.',
    array['property_name', 'property_type', 'location', 'listing_type', 'price'],
    true
  ),
  (
    'Email Property Introduction',
    'Email',
    'Email',
    'Subject: Property recommendation - {{property_name}}\n\nHi,\n\nI wanted to share {{property_name}} with you. It is a {{property_type}} in {{location}} available for {{listing_type}} at {{price}}.\n\nLet me know if you would like the full details or a viewing slot.',
    array['property_name', 'property_type', 'location', 'listing_type', 'price'],
    true
  ),
  (
    'TikTok Short Caption',
    'TikTok',
    'Caption',
    '{{property_name}} in {{location}}. {{property_type}} for {{listing_type}} from {{price}}. DM for details.',
    array['property_name', 'location', 'property_type', 'listing_type', 'price'],
    true
  );
