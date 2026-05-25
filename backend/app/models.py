from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRole(StrEnum):
    REN = "REN"
    MANAGER = "MANAGER"


class LeadStatus(StrEnum):
    ACTIVE = "Active"
    NEGOTIATING = "Negotiating"
    CLOSED = "Closed"
    LOST = "Lost"


class PropertyStatus(StrEnum):
    ACTIVE = "Active"
    PENDING = "Pending"
    INACTIVE = "Inactive"


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
    preferred_property_type: str | None = None
    status: LeadStatus
    created_at: datetime
    updated_at: datetime
    last_interaction_at: datetime


class Property(RoomahModel):
    id: UUID
    team_id: UUID
    ren_id: UUID
    name: str
    type: str
    location: str
    price: Decimal = Field(ge=0)
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
