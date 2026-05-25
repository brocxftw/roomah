# ROOMAH — Product Requirements Document (PRD)

# Version

v1.0 MVP

---

# 1. Product Overview

## Product Name

ROOMAH

## Product Description

ROOMAH is an operational CRM web application designed to reduce the pain of tracking leads, properties, viewings, and deals for Malaysian Real Estate Negotiators (RENs).

Current workflows rely heavily on Google Sheets and require repetitive manual updates across multiple spreadsheets.

ROOMAH replaces fragmented spreadsheet workflows with a central operational workspace.

---
## Vision

Create a simple operational system that allows RENs to spend less time updating records and more time engaging customers.

---

## Primary Objectives
- Reduce manual data entry
    - Centralise workflows
    - Improve operational visibility
    - Track customer lifecycle
    - Reduce missed follow-ups
    - Create a simple daily workflow for RENs
    

---

## Core Philosophy

> Do not make REN think.

> Show what needs action.

> Guide the workflow.

> Automate everything else.

---

# 2. Users

## Individual REN

Responsibilities:
- Manage leads
    - Manage properties
    - Schedule viewings
    - Track deals
    - Record customer interactions
    

---

## Team Manager

Responsibilities:
- Monitor REN activities
    - Track pipelines
    - Monitor commissions
    - View performance metrics
    

---

# 3. MVP Scope

Included:
- Authentication
    - Dashboard overview
    - Lead management
    - Property management
    - Viewing scheduling
    - Timeline tracking
    - Deal tracking
    - Team manager dashboard
    

Excluded:
- AI assistant
    - WhatsApp integrations
    - Multi-tenancy
    - SaaS subscriptions
    - Predictive analytics
    - Mobile application
    - CSV imports
    

---

# 4. Features

## Login

### Features
- Email login
    - Google OAuth login
    - Session persistence
    

---

## Dashboard Overview

Dashboard prioritises tasks over analytics.

### Sections

#### Today's Tasks

Displays:
- Follow-ups due
    - Upcoming viewings
    - Deals closing soon
    

---

### Quick Actions

Buttons:
- Add Lead
    - Add Property
    - Schedule Viewing
    

---

### KPI Summary

Display:
- Active Leads
    - Properties Listed
    - Deals Closed
    - Monthly Commission
    - Follow-ups Due
    

---

## Lead Management

### Features
- Create lead
    - Edit lead
    - Search lead
    - Filter lead
    

---

### Lead Workflow

New

↓

Active

↓

Closed

↓

Lost

---

### Lead Details

Display:
- Customer information
    - Budget range
    - Property preferences
    - Timeline history
    

---

### Lead Relationship Rules

One lead:
- Assigned to one REN
    

One lead:
- Can link to multiple properties
    

---

### Add Lead Wizard

#### Step 1

Customer Details

Fields:
- Name
    - Phone
    - Email
    

#### Step 2

Budget

Fields:
- Minimum budget
    - Maximum budget
    

#### Step 3

Property Preferences

Fields:
- Preferred location
    - Preferred property type
    

#### Step 4

Review

Actions:
- Create Lead
    

System automatically creates:
- lead_id
    - timestamps
    - initial timeline event
    

---

## Timeline System

### Automatic Events

Examples:
- Lead created
    - Property linked
    - Viewing scheduled
    - Deal closed
    

---

### Manual Events

Examples:
- Called customer
    - Negotiation note
    - Customer requested callback
    

---

## Property Management

### Features
- Create property
    - Edit property
    - Search property
    - Filter property
    - Upload images
    

---

### Property Status

Values:
- Active
    - Pending
    - Inactive
    

---

### Required Fields
- Property name
    - Property type
    - Location
    - Price
    - Status
    - Cover image
    

---

### Optional Fields
- Bedrooms
    - Bathrooms
    - Sqft
    - Parking
    - Furnishing
    - Description
    

---

### Image Support

Property supports:
- Multiple images
    - Cover image selection
    

---

### Add Property Wizard

#### Step 1

Basic Information

Fields:
- Property name
    - Type
    - Location
    - Price
    

#### Step 2

Additional Details

Fields:
- Bedrooms
    - Bathrooms
    - Sqft
    - Furnishing
    

#### Step 3

Images

Fields:
- Cover image
    - Gallery images
    

#### Step 4

Review

---

## Viewing Scheduler

Workflow:

Lead

↓

Choose property

↓

Select date and time

↓

Assign REN

↓

Save

---

Automatically:
- Creates timeline event
    

---

### After Viewing Completion

Show popup:

Customer Interest:

⭐ Not Interested

⭐⭐ Interested

⭐⭐⭐ Very Interested

Additional notes

Save:
- Interest level
    - Notes
    - Timeline event
    

Automatically:
- Suggest follow-up date
    

---

## Deal Workflow

When deal closes:

Automatically:
- Create transaction
    - Move lead to Closed
    - Move property to Pending/Inactive
    - Calculate commission
    - Create timeline event
    - Refresh dashboard metrics
    

---

## Commission Calculation

Default:

Commission

=

Property price

× commission rate

− agency fee

− lawyer fees

Allow:

Manual override

---

## Team Manager Dashboard

Display:
- REN name
    - Active leads
    - Lead pipeline
    - Viewing count
    - Commission
    - Monthly trend
    

---

# 5. Technology Stack

## Frontend
- NextJS
    - Typescript
    - TailwindCSS
    - Shadcn UI
    

---

## Backend
- FastAPI
    

---

## Database
- Supabase PostgreSQL
    - Supabase Storage
    

---

## ETL
- Python
    - Databricks
    

---

## Hosting
- Netlify
    

---

## Authentication
- Clerk
    - OAuth
    

---

## External Analytics
- Power BI
    

---

# 6. Success Metrics

MVP success indicators:
- Reduce spreadsheet usage significantly
    - Reduce manual data entry by 80%
    - Reduce missed follow-ups
    - Increase operational visibility
    - Improve daily workflow efficiency
    

---

# 7. Future Expansion

Potential future phases:
- WhatsApp integration
    - AI assistant
    - Lead scoring
    - Predictive analytics
    - Mobile application
    - Multi-agency support
    - SaaS subscriptions
    

---

# End of PRD