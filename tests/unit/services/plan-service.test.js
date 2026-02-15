// @ts-check

const PlanService = require('../../../src/services/plan-service');
const { REMINDER_STATUS, PLAN_LIMITS } = require('../../../src/lib/constants');

describe('PlanService', () => {
  let mockStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = {
      getReminders: jest.fn(),
      getUserPlan: jest.fn(),
    };
  });

  describe('canCreateReminder', () => {
    it('returns true when under free plan limit', async () => {
      mockStorage.getReminders.mockResolvedValue([
        { id: '1', status: REMINDER_STATUS.PENDING },
        { id: '2', status: REMINDER_STATUS.PENDING },
      ]);
      mockStorage.getUserPlan.mockResolvedValue({
        planType: 'free',
        activeReminderLimit: 5,
      });

      const result = await PlanService.canCreateReminder(mockStorage);
      expect(result).toBe(true);
    });

    it('returns false when at free plan limit', async () => {
      const reminders = Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        status: REMINDER_STATUS.PENDING,
      }));
      mockStorage.getReminders.mockResolvedValue(reminders);
      mockStorage.getUserPlan.mockResolvedValue({
        planType: 'free',
        activeReminderLimit: 5,
      });

      const result = await PlanService.canCreateReminder(mockStorage);
      expect(result).toBe(false);
    });

    it('returns true for paid plan regardless of count', async () => {
      const reminders = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        status: REMINDER_STATUS.PENDING,
      }));
      mockStorage.getReminders.mockResolvedValue(reminders);
      mockStorage.getUserPlan.mockResolvedValue({
        planType: 'paid',
        activeReminderLimit: PLAN_LIMITS.PAID_ACTIVE_REMINDER_LIMIT,
      });

      const result = await PlanService.canCreateReminder(mockStorage);
      expect(result).toBe(true);
    });

    it('only counts pending reminders toward limit', async () => {
      mockStorage.getReminders.mockResolvedValue([
        { id: '1', status: REMINDER_STATUS.PENDING },
        { id: '2', status: REMINDER_STATUS.COMPLETED },
        { id: '3', status: REMINDER_STATUS.COMPLETED },
        { id: '4', status: REMINDER_STATUS.PENDING },
      ]);
      mockStorage.getUserPlan.mockResolvedValue({
        planType: 'free',
        activeReminderLimit: 5,
      });

      const result = await PlanService.canCreateReminder(mockStorage);
      expect(result).toBe(true);
    });
  });

  describe('getPlanStatus', () => {
    it('returns complete plan status', async () => {
      mockStorage.getReminders.mockResolvedValue([
        { id: '1', status: REMINDER_STATUS.PENDING },
        { id: '2', status: REMINDER_STATUS.PENDING },
        { id: '3', status: REMINDER_STATUS.COMPLETED },
      ]);
      mockStorage.getUserPlan.mockResolvedValue({
        planType: 'free',
        activeReminderLimit: 5,
      });

      const status = await PlanService.getPlanStatus(mockStorage);
      expect(status).toEqual({
        planType: 'free',
        activeReminderLimit: 5,
        currentPendingCount: 2,
        canCreateReminder: true,
      });
    });

    it('reports canCreateReminder as false when at limit', async () => {
      const reminders = Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        status: REMINDER_STATUS.PENDING,
      }));
      mockStorage.getReminders.mockResolvedValue(reminders);
      mockStorage.getUserPlan.mockResolvedValue({
        planType: 'free',
        activeReminderLimit: 5,
      });

      const status = await PlanService.getPlanStatus(mockStorage);
      expect(status.canCreateReminder).toBe(false);
      expect(status.currentPendingCount).toBe(5);
    });
  });
});
