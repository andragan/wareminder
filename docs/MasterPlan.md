# WhatsApp Follow-Up Reminder Extension - Master Plan

**Product Requirements Document (PRD)**

- **Product:** WhatsApp Follow-Up Reminder Extension
- **Platform:** WhatsApp Web via Chrome Web Store
- **Version:** MVP v1.0
- **Target launch:** 4 weeks

## 1. Overview

### Problem

Small businesses using WhatsApp Web forget to follow up with customers.

**Example:**

> Customer: "I'll think about it."
> Business forgets → sale lost.

WhatsApp has no built-in follow-up reminder feature.

### Solution

Chrome extension that allows users to:

- set follow-up reminders per chat
- receive notifications at scheduled time
- see list of pending follow-ups

### Goal

Help businesses:

- increase sales
- stay organized
- never forget to follow up

## 2. Success Metrics

**Primary KPI:**

- Daily Active Users (DAU)

**Secondary KPIs:**

- reminders created per user
- reminder completion rate
- conversion to paid

**Revenue KPI:**

- 500 paying users within 6 months

## 3. Target Users

**Primary:**

- small business owners
- online sellers
- freelancers
- service providers

**Secondary:**

- recruiters
- salespeople

## 4. User Stories

### Core Story

> As a business owner,
> I want to set a reminder on a WhatsApp chat,
> So I remember to follow up later.

### Supporting Stories

User can:

- set reminder for a chat
- view all reminders
- receive notification
- mark reminder complete
- delete reminder

## 5. Features

### Feature 1: Set Reminder

**Description**

User sets reminder from chat interface.

**UI**

Add button inside WhatsApp chat header: "Set Reminder"

**Flow**

1. User clicks "Set Reminder"
2. Select time:
   - in 1 hour
   - tonight
   - tomorrow
   - custom date
3. Save

### Feature 2: Reminder Notification

**Description**

User receives notification when reminder is due.

Notification includes:

- customer name
- reminder time
- click → opens chat

### Feature 3: Reminder List Dashboard

**Description**

Popup shows all reminders.

**Fields:**

- customer name
- due date
- status

**Actions:**

- open chat
- mark complete
- delete

### Feature 4: Reminder Badge

Shows number of pending reminders.

**Example:** Extension icon shows badge with number (e.g., "3")

## 6. MVP Scope

**Include:**

- create reminder
- store reminder
- notification
- reminder list
- delete reminder

**Exclude (future):**

- recurring reminders
- team sync
- analytics
- AI suggestions

## 7. User Flow

1. Open WhatsApp Web
2. Open chat
3. Click "Set Reminder"
4. Choose time
5. Reminder saved
6. Later → Notification appears
7. User clicks → Chat opens

## 8. Functional Requirements

### FR-1 Reminder Creation

System must:

- allow reminder creation
- associate reminder with chat ID

### FR-2 Reminder Storage

System must store:

- chat ID
- chat name
- reminder time
- status

### FR-3 Notification

System must:

- trigger notification when due

### FR-4 Reminder List

System must:

- show all reminders

### FR-5 Reminder Completion

System must:

- allow marking complete

## 9. Non-Functional Requirements

**Performance:**

- load under 100ms

**Storage:**

- support 10,000 reminders

**Reliability:**

- reminders must not be lost

## 10. Technical Architecture

### Frontend

**Chrome Extension:**

- manifest v3
- content script
- popup UI

**Stack:**

- JavaScript
- HTML
- CSS
- Optional: Vue (if desired)

### Backend (optional for MVP)

MVP can use:

- Chrome local storage

**Future:**

- Supabase

### Database Schema (future Supabase)

**Table: reminders**

**Fields:**

- id
- user_id
- chat_id
- chat_name
- reminder_time
- status
- created_at

## 11. Monetization

**Free plan:**

- 5 reminders

**Paid plan:**

- unlimited reminders

**Price:**

- $3/month

## 12. Chrome Permissions

**Required:**

- storage
- notifications
- activeTab

**Host permission:**

- web.whatsapp.com

## 13. UX Requirements

Must feel:

- native
- simple
- fast

No clutter.

## 14. Risks

**Risk:** WhatsApp UI changes

**Mitigation:** use robust selectors

**Risk:** Chrome store rejection

**Mitigation:** follow Chrome policies

## 15. Timeline

**Week 1:**

- Core reminder logic

**Week 2:**

- UI integration

**Week 3:**

- Notifications

**Week 4:**

- Testing and launch

## 16. Future Features

After MVP success:

- recurring reminders
- sync across devices
- team support
- analytics

## 17. Definition of Done

MVP complete when user can:

- create reminder
- receive notification
- open chat from reminder

## 18. Revenue Projection

**Example:**

- 1000 users
- 5% convert paid = 50 paying users
- $3/month per user
- $150/month initial

**Scale target:**

- 1000 paying users
- $3000/month (~50M IDR)
