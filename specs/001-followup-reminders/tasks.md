# Tasks: WhatsApp Follow-Up Reminder Extension (MVP)

**Input**: Design documents from `/specs/001-followup-reminders/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Exact file paths included in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization, manifest, dev tooling, and shared constants/utilities

- [x] T001 Initialize npm project with package.json at repository root
- [x] T002 Create MV3 manifest.json per contracts/manifest.md in src/manifest.json
- [x] T003 [P] Configure ESLint with no-unused-vars, no-implicit-globals, consistent-return rules in .eslintrc.json
- [x] T004 [P] Configure Jest with jest-chrome and jsdom environment in jest.config.js
- [x] T005 [P] Create extension icon placeholders (16, 48, 128px) in src/icons/
- [x] T006 [P] Create i18n messages file with all user-facing strings in src/_locales/en/messages.json

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared services and utilities that ALL user stories depend on. No story work can begin until this phase is complete.

**⚠️ CRITICAL**: Every user story depends on storage-service, reminder-service, validators, utils, and constants.

- [x] T007 Define named constants (plan limits, alarm prefix, storage keys, default times, CSS selectors) in src/lib/constants.js
- [x] T008 [P] Implement input validators (future time, JID format, required fields, status enum) in src/lib/validators.js
- [x] T009 [P] Implement shared utilities (UUID generation, date formatting, navigation URL builder) in src/lib/utils.js
- [x] T010 Implement storage service (getReminders, saveReminders, getUserPlan, saveUserPlan, onRemindersChanged) per contracts/services.md in src/services/storage-service.js
- [x] T011 [P] Implement plan service (canCreateReminder, getPlanStatus) per contracts/services.md in src/services/plan-service.js
- [x] T012 [P] Implement chat service (navigateToChat with tab find-or-create logic) per contracts/services.md in src/services/chat-service.js
- [x] T013 Implement reminder service (createReminder, completeReminder, deleteReminder, getAllReminders, getOverdueReminders, cleanupExpiredCompleted) per contracts/services.md in src/services/reminder-service.js
- [x] T014 Implement service worker entry point with onInstalled handler (initialize userPlan defaults, reconcile alarms, run auto-cleanup) in src/background/service-worker.js
- [x] T015 [P] Write unit tests for validators in tests/unit/lib/validators.test.js
- [x] T016 [P] Write unit tests for utils in tests/unit/lib/utils.test.js
- [x] T017 [P] Write unit tests for storage-service in tests/unit/services/storage-service.test.js
- [x] T018 [P] Write unit tests for plan-service in tests/unit/services/plan-service.test.js
- [x] T019 [P] Write unit tests for chat-service in tests/unit/services/chat-service.test.js
- [x] T020 Write unit tests for reminder-service in tests/unit/services/reminder-service.test.js

**Checkpoint**: All shared services tested and working. Foundation ready — user story implementation can begin.

---

## Phase 3: User Story 1 — Create a Follow-Up Reminder (Priority: P1) 🎯 MVP

**Goal**: User clicks "Set Reminder" in WhatsApp Web chat header, selects a time, and the reminder is saved with a Chrome alarm scheduled.

**Independent Test**: Open any WhatsApp Web chat → click "Set Reminder" → select a time → verify reminder appears in chrome.storage.local and alarm is registered.

**Spec**: US1 acceptance scenarios 1–5, FR-001 through FR-004, FR-009, FR-013, FR-017

### Implementation for User Story 1

- [x] T021 [P] [US1] Implement MutationObserver for WhatsApp Web DOM changes (observe #app, debounced, detect #main header) in src/content/chat-observer.js
- [x] T022 [P] [US1] Implement chat context extraction (chatId from sidebar [data-id], chatName from header) in src/content/injector.js
- [x] T023 [US1] Implement "Set Reminder" button injection into WhatsApp Web chat header action buttons row in src/content/injector.js
- [x] T024 [US1] Implement time-selection prompt UI (preset options: 1 hour, tonight, tomorrow, custom date/time picker; each preset MUST resolve and display the absolute datetime before user confirms) in src/content/reminder-prompt.js
- [x] T025 [P] [US1] Implement content script styles matching WhatsApp Web visual language (button, prompt, confirmation, error states, hover states, loading spinner during save, disabled state while saving) in src/content/styles.css
- [x] T026 [US1] Wire content script message passing: send CREATE_REMINDER to service worker, display success confirmation or error inline per contracts/messages.md in src/content/reminder-prompt.js
- [x] T027 [US1] Add message handler for CREATE_REMINDER in service worker (validate, check plan limit, create reminder, schedule alarm) in src/background/service-worker.js
- [x] T028 [US1] Handle injection failure detection and fallback notification guiding user to popup dashboard per FR-013 in src/content/injector.js
- [x] T029 [US1] Handle prompt dismissal on navigation away from WhatsApp Web (graceful cleanup, no incomplete saves) in src/content/reminder-prompt.js
- [x] T030 [US1] Implement alarm scheduling (chrome.alarms.create with when parameter, name: reminder-<id>) in src/background/alarm-handler.js
- [x] T031 [P] [US1] Write integration test for content script ↔ storage interaction (create reminder end-to-end) in tests/integration/content-storage.test.js
- [x] T032 [P] [US1] Write e2e acceptance test for reminder creation lifecycle (create → verify storage → verify alarm) per constitution II in tests/e2e/create-reminder.test.js

**Checkpoint**: User Story 1 fully functional. User can create reminders from WhatsApp Web chat header. Reminders persist in storage with alarms scheduled. Plan limits enforced.

---

## Phase 4: User Story 2 — Receive a Follow-Up Notification (Priority: P2)

**Goal**: When a reminder's scheduled time arrives, a desktop notification fires with the contact name. Clicking the notification navigates to the correct WhatsApp Web chat.

**Independent Test**: Create a reminder set to fire in 1 minute → wait for notification → click notification → verify correct chat opens (existing tab reused or new tab created).

**Spec**: US2 acceptance scenarios 1–4, FR-005, FR-006, FR-014, FR-016, FR-017

### Implementation for User Story 2

- [x] T033 [US2] Implement alarm handler (chrome.alarms.onAlarm listener, look up reminder by alarm name, trigger notification) in src/background/alarm-handler.js
- [x] T034 [US2] Implement notification creation (chrome.notifications.create with contact name, time, requireInteraction, icon) in src/background/notification-handler.js
- [x] T035 [US2] Implement notification click handler (chrome.notifications.onClicked, navigate to chat via chat-service, clear notification) in src/background/notification-handler.js
- [x] T036 [US2] Add overdue reminder check on service worker startup (scan storage for past-due pending reminders, fire notifications) in src/background/service-worker.js
- [x] T037 [US2] Add alarm reconciliation on service worker startup and onInstalled update (re-register missing alarms from storage) in src/background/service-worker.js
- [x] T038 [US2] Add message handler for CHECK_NOTIFICATION_PERMISSION in service worker per contracts/messages.md in src/background/service-worker.js
- [x] T039 [P] [US2] Write integration test for alarm firing ↔ notification creation flow in tests/integration/alarm-notification.test.js
- [x] T040 [P] [US2] Write e2e acceptance test for notification lifecycle (create → alarm fires → notification → click → chat opens) per constitution II in tests/e2e/receive-notification.test.js

**Checkpoint**: User Story 2 fully functional. Reminders trigger desktop notifications at scheduled time. Clicking notifications navigates to correct chat. Overdue reminders detected on startup.

---

## Phase 5: User Story 3 — View and Manage All Reminders (Priority: P3)

**Goal**: Popup dashboard lists all reminders sorted by due date with actions to open chat, mark complete, and delete. Empty state shown when no reminders exist.

**Independent Test**: Create several reminders (some overdue, some upcoming) → open popup → verify sorted list with correct data → exercise open chat, complete, and delete actions independently.

**Spec**: US3 acceptance scenarios 1–5, FR-007, FR-010, FR-012, FR-015, FR-016

### Implementation for User Story 3

- [x] T041 [P] [US3] Create popup HTML structure (reminder list container, empty state, overdue/upcoming sections, notification permission warning) in src/popup/popup.html
- [x] T042 [P] [US3] Create popup styles (400px width, WhatsApp-consistent palette, overdue visual distinction, loading/empty states, confirmation dialog) in src/popup/popup.css
- [x] T043 [US3] Implement popup JS: load and render reminder list sorted by scheduledTime (soonest first), distinguish overdue vs upcoming in src/popup/popup.js
- [x] T044 [US3] Implement "Open Chat" action in popup (send message to service worker or call chat-service) in src/popup/popup.js
- [x] T045 [US3] Implement "Mark Complete" action in popup (send COMPLETE_REMINDER message, update UI reactively) in src/popup/popup.js
- [x] T046 [US3] Implement "Delete" action with confirmation prompt in popup (send DELETE_REMINDER message, update UI) in src/popup/popup.js
- [x] T047 [US3] Implement empty state display when no reminders exist per FR-012 in src/popup/popup.js
- [x] T048 [US3] Add message handlers for COMPLETE_REMINDER, DELETE_REMINDER, GET_REMINDERS in service worker per contracts/messages.md in src/background/service-worker.js
- [x] T049 [US3] Implement auto-cleanup of completed reminders older than 30 days (cleanupExpiredCompleted on onInstalled and periodic) per FR-015 in src/background/service-worker.js
- [x] T050 [US3] Add notification permission check indicator in popup (warn if denied, link to re-enable) in src/popup/popup.js
- [x] T051 [US3] Implement virtual scrolling or pagination when reminder count exceeds 100 per constitution IV (support 10,000 reminders without lag per SC-003) in src/popup/popup.js
- [x] T052 [P] [US3] Write integration test for popup ↔ storage interaction (render list, complete, delete) in tests/integration/popup-storage.test.js
- [x] T053 [P] [US3] Write e2e acceptance test for dashboard management lifecycle (view → complete → delete → empty state) per constitution II in tests/e2e/manage-reminders.test.js

**Checkpoint**: User Story 3 fully functional. Users can view, triage, complete, and delete reminders from the popup dashboard. Completed reminders auto-purged after 30 days. Large lists handled via pagination.

---

## Phase 6: User Story 4 — Pending Reminder Badge Count (Priority: P4)

**Goal**: Extension icon badge displays the count of pending reminders in real time. Badge clears when count reaches zero.

**Independent Test**: Create reminders → verify badge increments → complete/delete reminders → verify badge decrements → reach zero → verify badge disappears.

**Spec**: US4 acceptance scenarios 1–3, FR-008

### Implementation for User Story 4

- [x] T054 [US4] Implement badge update via chrome.storage.onChanged listener (count pending reminders, setBadgeText, setBadgeBackgroundColor WhatsApp green) in src/background/service-worker.js
- [x] T055 [US4] Initialize badge count on service worker startup (read storage, set initial badge) in src/background/service-worker.js
- [x] T056 [US4] Handle badge clear when pending count reaches zero (setBadgeText empty string) in src/background/service-worker.js
- [x] T057 [P] [US4] Write e2e acceptance test for badge count lifecycle (create → increment → complete → decrement → zero → clear) per constitution II in tests/e2e/badge-count.test.js

**Checkpoint**: User Story 4 fully functional. Badge reflects pending reminder count, updates reactively on all storage changes, clears on zero.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, hardening, documentation, and quality gates

- [x] T058 [P] Add storage quota warning at 90% capacity (check on reminder creation, warn user before refusing) per edge case in src/services/reminder-service.js
- [x] T059 [P] Handle unavailable chat on notification click (show inline message if chat can't be opened) per edge case in src/background/notification-handler.js
- [x] T060 [P] Add GET_PLAN_STATUS message handler in service worker per contracts/messages.md in src/background/service-worker.js
- [x] T061 Ensure all public functions have JSDoc comments across all src/ files per constitution
- [x] T062 Add // @ts-check annotations to all JavaScript files in src/ per constitution
- [x] T063 Run ESLint across all src/ files and fix any warnings to achieve zero-warning gate
- [x] T064 Run full test suite (npm test) and verify ≥80% statement coverage per constitution
- [x] T065 Verify bundle size ≤500KB uncompressed across all src/ assets per constitution
- [x] T066 Run quickstart.md smoke test checklist to validate end-to-end flows

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US1)**: Depends on Phase 2 — No dependencies on other stories
- **Phase 4 (US2)**: Depends on Phase 2 + T030 from US1 (alarm scheduling) — Can partially parallel with US1
- **Phase 5 (US3)**: Depends on Phase 2 — Can parallel with US1/US2
- **Phase 6 (US4)**: Depends on Phase 2 — Can parallel with any story
- **Phase 7 (Polish)**: Depends on all desired user stories being complete

### Within Each User Story

- Models/entities before services (handled in Phase 2)
- Services before content script / service worker handlers
- Core implementation before integration tests
- Story complete and testable before moving to next priority

### Parallel Opportunities

- T003, T004, T005, T006 can all run in parallel (Phase 1)
- T008, T009 can parallel; T011, T012 can parallel after T010 (Phase 2)
- T015–T020 unit tests can all run in parallel (Phase 2)
- T021, T022, T025 can parallel (Phase 3)
- T041, T042 can parallel (Phase 5)
- T058, T059, T060 can all parallel (Phase 7)
- User Stories 3 and 4 are fully independent and can parallel after Phase 2

---

## Parallel Example: User Story 1

```
# Phase 3 parallel group 1 (independent files):
T021: chat-observer.js       ← can parallel
T022: injector.js (extraction) ← can parallel
T025: styles.css             ← can parallel

# Phase 3 sequential (depends on above):
T023: injector.js (button injection) ← depends on T021, T022
T024: reminder-prompt.js ← depends on T023
T026: reminder-prompt.js (message passing) ← depends on T024
T027: service-worker.js (handler) ← depends on T013 (Phase 2)
T030: alarm-handler.js ← depends on T027

# Phase 3 parallel group 2 (after implementation):
T031: integration test ← after T026, T027
T032: e2e test ← after T026, T027
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T006)
2. Complete Phase 2: Foundational (T007–T020)
3. Complete Phase 3: User Story 1 (T021–T032)
4. **STOP and VALIDATE**: Manually test reminder creation on WhatsApp Web
5. Deploy/demo if ready — user can create and store reminders

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → **MVP!** (reminders created and stored)
3. Add User Story 2 → Test independently → Notifications close the loop
4. Add User Story 3 → Test independently → Full management UI
5. Add User Story 4 → Test independently → Badge polish
6. Polish phase → Quality gates → Chrome Web Store submission

### Single Developer Strategy

1. Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7
2. Each phase is a natural commit boundary
3. Each user story is a PR-worthy increment

---

## Notes

- All services follow single-writer pattern: only the service worker writes to chrome.storage.local
- Alarm naming convention: `reminder-<uuid>` per research.md §2.4
- Content script is a thin UI layer; all business logic lives in services/ (invoked via message passing)
- No runtime dependencies — all devDependencies only (jest, eslint, jest-chrome)
- 66 total tasks across 7 phases
