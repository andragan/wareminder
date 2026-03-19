/**
 * E2E acceptance test: Badge count lifecycle.
 * Tests: create → increment → complete → decrement → zero → clear.
 */

const {
    REMINDER_STATUS,
    ALARM_PREFIX,
    BADGE_COLOR,
} = require("../../src/lib/constants");
const ReminderService = require("../../src/services/reminder-service");

describe("E2E: Badge Count Lifecycle", () => {
    let mockStorage;
    let storedReminders;

    // SETUP: Initialize mocks and test doubles before each test
    beforeEach(() => {
        jest.clearAllMocks();
        storedReminders = [];

        // Mock Chrome Alarms API for reminder scheduling
        chrome.alarms.create.mockResolvedValue(undefined);
        chrome.alarms.clear.mockResolvedValue(true);

        // Mock Chrome Action API for badge UI (requires polyfill since jest-chrome may not include it)
        if (!chrome.action) {
            chrome.action = {};
        }
        chrome.action.setBadgeText = jest.fn().mockResolvedValue(undefined);
        chrome.action.setBadgeBackgroundColor = jest
            .fn()
            .mockResolvedValue(undefined);

        // Mock StorageService: simulates Chrome storage with in-memory backup
        mockStorage = {
            getReminders: jest.fn(() => Promise.resolve([...storedReminders])),
            saveReminders: jest.fn((reminders) => {
                storedReminders = [...reminders];
                return Promise.resolve();
            }),
        };
    });

    /**
     * HELPER: Simulates the badge update logic from service-worker.js
     * - Fetches all reminders from storage
     * - Counts only PENDING reminders (excludes completed/deleted)
     * - Updates badge text (number or empty string if zero)
     * - Sets badge background color
     */
    async function updateBadge() {
        const allReminders = await mockStorage.getReminders();
        const pendingCount = allReminders.filter(
            (r) => r.status === REMINDER_STATUS.PENDING,
        ).length;
        await chrome.action.setBadgeText({
            text: pendingCount > 0 ? String(pendingCount) : "",
        });
        await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
    }

    // TEST 1: Full lifecycle—verify badge updates on create, complete, and delete operations
    it("full lifecycle: create → badge shows count → complete → badge decrements → zero → badge clears", async () => {
        const deps = { storage: mockStorage };

        // Step 1: Create first reminder → verify badge updates to "1"
        const r1 = await ReminderService.createReminder(
            {
                chatId: "5511111111111@c.us",
                chatName: "Alice",
                scheduledTime: Date.now() + 3600000,
            },
            deps,
        );
        await updateBadge();
        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({
            text: "1",
        });
        expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({
            color: BADGE_COLOR,
        });

        // Step 2: Create second reminder → verify badge updates to "2"
        const r2 = await ReminderService.createReminder(
            {
                chatId: "5522222222222@c.us",
                chatName: "Bob",
                scheduledTime: Date.now() + 7200000,
            },
            deps,
        );
        await updateBadge();
        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({
            text: "2",
        });

        // Step 3: Complete first reminder → verify badge decrements to "1"
        await ReminderService.completeReminder(r1.id, deps);
        await updateBadge();
        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({
            text: "1",
        });

        // Step 4: Complete second reminder → verify badge clears (shows empty string)
        await ReminderService.completeReminder(r2.id, deps);
        await updateBadge();
        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({
            text: "",
        });
    });

    // TEST 2: Delete operations—verify badge decrements correctly when reminders are deleted
    it("badge decrements on delete", async () => {
        const deps = { storage: mockStorage };

        const r1 = await ReminderService.createReminder(
            {
                chatId: "5511111111111@c.us",
                chatName: "Alice",
                scheduledTime: Date.now() + 3600000,
            },
            deps,
        );
        const r2 = await ReminderService.createReminder(
            {
                chatId: "5522222222222@c.us",
                chatName: "Bob",
                scheduledTime: Date.now() + 7200000,
            },
            deps,
        );
        await updateBadge();
        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({
            text: "2",
        });

        await ReminderService.deleteReminder(r1.id, deps);
        await updateBadge();
        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({
            text: "1",
        });

        await ReminderService.deleteReminder(r2.id, deps);
        await updateBadge();
        expect(chrome.action.setBadgeText).toHaveBeenLastCalledWith({
            text: "",
        });
    });

    // TEST 3: Startup scenario—verify badge correctly reflects pending count from pre-stored reminders
    it("badge initializes correctly on startup with existing reminders", async () => {
        // Pre-populate storage with 2 pending + 1 completed reminder
        storedReminders = [
            {
                id: "r1",
                chatId: "5511111111111@c.us",
                chatName: "A",
                scheduledTime: Date.now() + 3600000,
                status: REMINDER_STATUS.PENDING,
                createdAt: Date.now(),
                completedAt: null,
            },
            {
                id: "r2",
                chatId: "5522222222222@c.us",
                chatName: "B",
                scheduledTime: Date.now() + 7200000,
                status: REMINDER_STATUS.PENDING,
                createdAt: Date.now(),
                completedAt: null,
            },
            {
                id: "r3",
                chatId: "5533333333333@c.us",
                chatName: "C",
                scheduledTime: Date.now() - 60000,
                status: REMINDER_STATUS.COMPLETED,
                createdAt: Date.now() - 120000,
                completedAt: Date.now() - 60000,
            },
        ];

        // On startup, badge should show "2" (only pending count, excludes completed)
        await updateBadge();
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "2" });
    });

    // TEST 4: Empty state—verify badge clears when no pending reminders exist
    it("badge shows empty string when all reminders are completed", async () => {
        storedReminders = [
            {
                id: "r1",
                chatId: "5511111111111@c.us",
                chatName: "A",
                scheduledTime: Date.now() - 60000,
                status: REMINDER_STATUS.COMPLETED,
                createdAt: Date.now() - 120000,
                completedAt: Date.now() - 60000,
            },
        ];

        await updateBadge();
        expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: "" });
    });
});
