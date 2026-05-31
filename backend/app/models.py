from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class UserRole(StrEnum):
    REN = "REN"
    MANAGER = "MANAGER"


class LeadStatus(StrEnum):
    NEW = "New"
    CONTACTED = "Contacted"
    QUALIFIED = "Qualified"
    PROPOSAL = "Proposal"
    NEGOTIATION = "Negotiation"
    WON = "Won"
    LOST = "Lost"


class PropertyStatus(StrEnum):
    ACTIVE = "Active"
    PENDING = "Pending"
    INACTIVE = "Inactive"


class ListingType(StrEnum):
    SALE = "Sale"
    RENTAL = "Rental"
    BOTH = "Both"


class CampaignChannel(StrEnum):
    FACEBOOK = "Facebook"
    INSTAGRAM = "Instagram"
    GOOGLE = "Google"
    TIKTOK = "TikTok"
    EMAIL = "Email"
    REFERRAL = "Referral"
    WALK_IN = "Walk_In"
    OTHER = "Other"


class CampaignStatus(StrEnum):
    DRAFT = "Draft"
    ACTIVE = "Active"
    PAUSED = "Paused"
    COMPLETED = "Completed"


class LeadPropertyStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class ViewingStatus(StrEnum):
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class TimelineEventSource(StrEnum):
    SYSTEM = "system"
    USER = "user"


class TimelineEventType(StrEnum):
    LEAD_CREATED = "lead_created"
    PROPERTY_LINKED = "property_linked"
    PROPERTY_UNLINKED = "property_unlinked"
    LEAD_CAMPAIGN_ATTRIBUTED = "lead_campaign_attributed"
    LEAD_CAMPAIGN_REATTRIBUTED = "lead_campaign_reattributed"
    VIEWING_SCHEDULED = "viewing_scheduled"
    VIEWING_COMPLETED = "viewing_completed"
    VIEWING_REASSIGNED = "viewing_reassigned"
    DEAL_CLOSED = "deal_closed"
    LEAD_STATUS_CHANGED = "lead_status_changed"
    LEAD_REASSIGNED = "lead_reassigned"
    MANUAL_CALL = "manual_call"
    MANUAL_NOTE = "manual_note"
    MANUAL_CALLBACK = "manual_callback"


class RoomahModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Team(RoomahModel):
    id: UUID
    name: str
    created_at: datetime


class User(RoomahModel):
    id: UUID
    auth_user_id: UUID
    team_id: UUID
    email: EmailStr
    role: UserRole
    commission_rate: Decimal = Field(ge=0)
    full_name: str
    phone_number: str | None = None
    active_status: bool
    created_at: datetime


class TeamConfig(RoomahModel):
    team_id: UUID
    default_agency_fee: Decimal = Field(ge=0)
    default_lawyer_fees: Decimal = Field(ge=0)
    updated_at: datetime


class Lead(RoomahModel):
    id: UUID
    team_id: UUID
    ren_id: UUID
    name: str
    phone: str
    email: EmailStr
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    preferred_location: str | None = None
    preferred_state: str | None = None
    preferred_city: str | None = None
    preferred_areas: list[str] | None = None
    preferred_property_type: str | None = None
    campaign_id: UUID | None = None
    status: LeadStatus
    created_at: datetime
    updated_at: datetime
    last_interaction_at: datetime


class MarketingCampaign(RoomahModel):
    id: UUID
    team_id: UUID
    name: str
    channel: CampaignChannel
    status: CampaignStatus
    campaign_start_date: date
    campaign_end_date: date | None = None
    ad_spending: Decimal = Field(ge=0)
    impressions: int = Field(ge=0)
    clicks: int = Field(ge=0)
    leads_generated: int = Field(ge=0)
    conversions: int = Field(ge=0)
    cost_per_lead: Decimal | None = Field(default=None, ge=0)
    conversion_rate: Decimal | None = Field(default=None, ge=0)
    budget: Decimal | None = Field(default=None, ge=0)
    created_by: UUID
    created_at: datetime
    updated_at: datetime


class MarketingCampaignSummary(RoomahModel):
    id: UUID
    name: str
    channel: CampaignChannel
    status: CampaignStatus


class MarketingCampaignCreate(RoomahModel):
    name: str = Field(min_length=1)
    channel: CampaignChannel
    campaign_start_date: date
    campaign_end_date: date | None = None
    ad_spending: Decimal = Field(default=Decimal("0"), ge=0)
    impressions: int = Field(default=0, ge=0)
    clicks: int = Field(default=0, ge=0)
    budget: Decimal | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_campaign_metrics(self) -> "MarketingCampaignCreate":
        if self.campaign_end_date is not None and (
            self.campaign_end_date < self.campaign_start_date
        ):
            raise ValueError("campaign_end_date must be after campaign_start_date")
        if self.clicks > self.impressions:
            raise ValueError("clicks must be less than or equal to impressions")
        return self


class MarketingCampaignUpdate(RoomahModel):
    name: str | None = Field(default=None, min_length=1)
    channel: CampaignChannel | None = None
    status: CampaignStatus | None = None
    campaign_start_date: date | None = None
    campaign_end_date: date | None = None
    ad_spending: Decimal | None = Field(default=None, ge=0)
    impressions: int | None = Field(default=None, ge=0)
    clicks: int | None = Field(default=None, ge=0)
    budget: Decimal | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_campaign_metrics(self) -> "MarketingCampaignUpdate":
        if (
            self.campaign_start_date is not None
            and self.campaign_end_date is not None
            and self.campaign_end_date < self.campaign_start_date
        ):
            raise ValueError("campaign_end_date must be after campaign_start_date")
        if (
            self.clicks is not None
            and self.impressions is not None
            and self.clicks > self.impressions
        ):
            raise ValueError("clicks must be less than or equal to impressions")
        return self


class Property(RoomahModel):
    id: UUID
    team_id: UUID
    ren_id: UUID
    name: str
    type: str
    owner_name: str
    owner_email: EmailStr
    owner_phone: str
    address_line_1: str
    address_line_2: str | None = None
    city: str
    state: str
    postcode: str
    price: Decimal = Field(ge=0)
    listing_type: ListingType
    market_value: Decimal | None = Field(default=None, ge=0)
    listing_price: Decimal | None = Field(default=None, ge=0)
    expected_rental: Decimal | None = Field(default=None, ge=0)
    year_built: int | None = Field(default=None, ge=1900)
    maintenance_fee: Decimal | None = Field(default=None, ge=0)
    status: PropertyStatus
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: int | None = Field(default=None, ge=0)
    sqft: int | None = Field(default=None, ge=0)
    parking: int | None = Field(default=None, ge=0)
    furnishing: str | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime


class PropertyImage(RoomahModel):
    id: UUID
    property_id: UUID
    storage_path: str
    is_cover: bool
    sort_order: int = Field(ge=0)
    created_at: datetime


class LeadProperty(RoomahModel):
    lead_id: UUID
    property_id: UUID
    status: LeadPropertyStatus
    created_at: datetime


class Viewing(RoomahModel):
    id: UUID
    team_id: UUID
    lead_id: UUID
    property_id: UUID
    assigned_ren_id: UUID
    scheduled_at: datetime
    status: ViewingStatus
    interest_level: int | None = Field(default=None, ge=1, le=3)
    notes: str | None = None
    completed_at: datetime | None = None
    created_at: datetime


class Deal(RoomahModel):
    id: UUID
    team_id: UUID
    lead_id: UUID
    property_id: UUID
    ren_id: UUID
    sale_price: Decimal = Field(ge=0)
    commission_rate: Decimal = Field(ge=0)
    agency_fee: Decimal = Field(ge=0)
    lawyer_fees: Decimal = Field(ge=0)
    commission_total: Decimal
    commission_override: Decimal | None = None
    closed_at: datetime
    created_at: datetime


class TimelineEvent(RoomahModel):
    id: UUID
    team_id: UUID
    lead_id: UUID
    event_type: TimelineEventType
    source: TimelineEventSource
    payload: dict[str, Any]
    created_by: UUID | None = None
    created_at: datetime


class LeadCampaignAttributedPayload(RoomahModel):
    to_campaign_id: UUID
    to_campaign_name: str


class LeadCampaignReattributedPayload(RoomahModel):
    from_campaign_id: UUID | None = None
    from_campaign_name: str | None = None
    to_campaign_id: UUID | None = None
    to_campaign_name: str | None = None
