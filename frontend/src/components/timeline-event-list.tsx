type TimelineEvent = {
  id: string;
  event_type: string;
  source: string;
  payload: Record<string, unknown>;
  created_at: string;
};

const eventLabels: Record<string, string> = {
  lead_created: "Lead created",
  property_linked: "Property linked",
  property_unlinked: "Property unlinked",
  viewing_scheduled: "Viewing scheduled",
  viewing_completed: "Viewing completed",
  viewing_reassigned: "Viewing reassigned",
  deal_closed: "Deal closed",
  lead_status_changed: "Lead status changed",
  lead_reassigned: "Lead reassigned",
  manual_call: "Called customer",
  manual_note: "Negotiation note",
  manual_callback: "Callback requested",
};

function describeEvent(event: TimelineEvent) {
  if (event.event_type === "viewing_completed") {
    return `Interest: ${event.payload.interest_level ?? "-"} star(s)`;
  }
  if (event.event_type === "lead_status_changed") {
    return `${event.payload.from ?? "-"} -> ${event.payload.to ?? "-"}`;
  }
  if (
    event.event_type === "manual_call" ||
    event.event_type === "manual_note" ||
    event.event_type === "manual_callback"
  ) {
    return String(event.payload.note ?? "");
  }

  return event.source;
}

export function TimelineEventList({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="rounded-lg border">
      <div className="border-b p-4">
        <h3 className="font-medium">Timeline</h3>
      </div>
      {events.map((event) => (
        <div key={event.id} className="border-b p-4 last:border-b-0">
          <p className="font-medium">
            {eventLabels[event.event_type] ?? event.event_type}
          </p>
          <p className="text-sm text-muted-foreground">
            {new Date(event.created_at).toLocaleString()}
          </p>
          <p className="mt-1 text-sm">{describeEvent(event)}</p>
        </div>
      ))}
      {!events.length ? (
        <p className="p-4 text-sm text-muted-foreground">
          No timeline events yet.
        </p>
      ) : null}
    </section>
  );
}

export type { TimelineEvent };
