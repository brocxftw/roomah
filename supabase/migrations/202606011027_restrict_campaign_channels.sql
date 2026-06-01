-- Tighten the marketing_campaigns.channel allowed values to the new short list
-- (Facebook, WhatsApp, TikTok, Threads, Instagram, Mudah.my, Others) and
-- introduce ``channel_other_label`` so users can specify a custom channel name
-- when picking ``Others``.
--
-- The legacy ``campaign_channel`` enum included Google/Email/Referral/Walk_In/Other.
-- Postgres does not allow dropping enum values in place, so we replace the type:
-- (1) build a new enum, (2) cast the column with a CASE that maps every legacy
-- value, (3) drop the old type, and (4) rename the new type back. Existing
-- rows that used a retired channel become ``Others`` with the legacy value
-- preserved in ``channel_other_label``.

-- 1. Add the new column up front so we can populate it before the column type
--    swap collapses legacy values into ``Others``.
alter table public.marketing_campaigns
  add column if not exists channel_other_label text;

update public.marketing_campaigns
set channel_other_label = case channel::text
  when 'Google' then 'Google'
  when 'Email' then 'Email'
  when 'Referral' then 'Referral'
  when 'Walk_In' then 'Walk-in'
  else channel_other_label
end
where channel::text in ('Google', 'Email', 'Referral', 'Walk_In');

-- 2. Build the replacement enum.
create type public.campaign_channel_new as enum (
  'Facebook',
  'WhatsApp',
  'TikTok',
  'Threads',
  'Instagram',
  'Mudah.my',
  'Others'
);

-- 3. Swap the column type. Anything that doesn't match a sanctioned value
--    collapses to 'Others' (its original name lives on in
--    ``channel_other_label`` from step 1).
alter table public.marketing_campaigns
  alter column channel type public.campaign_channel_new
  using (
    case channel::text
      when 'Facebook' then 'Facebook'
      when 'WhatsApp' then 'WhatsApp'
      when 'TikTok' then 'TikTok'
      when 'Threads' then 'Threads'
      when 'Instagram' then 'Instagram'
      when 'Mudah.my' then 'Mudah.my'
      else 'Others'
    end::public.campaign_channel_new
  );

-- 4. Drop the legacy enum and rename the new one to take its place.
drop type public.campaign_channel;
alter type public.campaign_channel_new rename to campaign_channel;

-- 5. ``channel_other_label`` only makes sense when channel = 'Others' and must
--    be non-empty when present.
alter table public.marketing_campaigns
  add constraint marketing_campaigns_channel_other_label_check
  check (
    (channel = 'Others' and (channel_other_label is null or btrim(channel_other_label) <> ''))
    or (channel <> 'Others' and channel_other_label is null)
  );

-- 6. Retire the Email starter content template now that Email is no longer a
--    first-class campaign channel. The remaining starters cover the four
--    sanctioned channels (Facebook, Instagram, TikTok, WhatsApp).
delete from public.campaign_content_templates
where is_starter
  and name = 'Email Property Introduction';
