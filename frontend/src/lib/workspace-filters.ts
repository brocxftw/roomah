export const OVERDUE_FOLLOW_UP_DAYS = 2;

type LeadLike = {
  status: string;
  last_interaction_at?: string | null;
};

type ViewingLike = {
  scheduled_at: string;
};

export function isOverdueLead(lead: LeadLike, now = new Date()) {
  if (!["Active", "Negotiating"].includes(lead.status)) {
    return false;
  }
  if (!lead.last_interaction_at) {
    return false;
  }

  const overdueBefore = new Date(now);
  overdueBefore.setDate(overdueBefore.getDate() - OVERDUE_FOLLOW_UP_DAYS);

  return new Date(lead.last_interaction_at).getTime() <= overdueBefore.getTime();
}

export function isViewingToday(viewing: ViewingLike, now = new Date()) {
  const scheduledAt = new Date(viewing.scheduled_at);

  return (
    scheduledAt.getFullYear() === now.getFullYear() &&
    scheduledAt.getMonth() === now.getMonth() &&
    scheduledAt.getDate() === now.getDate()
  );
}

export function isSupportedLeadStatusFilter(value: string | null) {
  return value === "overdue";
}

export function isSupportedDealStatusFilter(value: string | null) {
  return value === "closing";
}
