-- The deal pipeline workflow and campaign attribution flows emit timeline
-- events whose names were never added to the `timeline_event_type` enum.
-- Without these values the deal routes (create/win/lose/stage_change/
-- documents) and the campaign attribution helpers fail with `22P02`.

alter type public.timeline_event_type add value if not exists 'lead_campaign_attributed';
alter type public.timeline_event_type add value if not exists 'lead_campaign_reattributed';
alter type public.timeline_event_type add value if not exists 'deal_created';
alter type public.timeline_event_type add value if not exists 'deal_stage_changed';
alter type public.timeline_event_type add value if not exists 'deal_note_updated';
alter type public.timeline_event_type add value if not exists 'deal_document_added';
alter type public.timeline_event_type add value if not exists 'deal_document_removed';
alter type public.timeline_event_type add value if not exists 'deal_won';
alter type public.timeline_event_type add value if not exists 'deal_lost';
