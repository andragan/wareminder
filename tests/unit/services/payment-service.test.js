// @ts-check
/**
 * Unit tests for payment-service
 * Tests Stripe integration, checkout initiation, customer portal access
 * @jest-environment jsdom
 */

import * as paymentService from '../../../src/services/payment-service.js';

global.fetch = jest.fn();
global.chrome = {
  tabs: {
    create: jest.fn(),
  },
  identity: {
    getAuthToken: jest.fn((opts, cb) => {
      setTimeout(() => cb('mock-token-123'), 10);
    }),
  },
  runtime: {
    lastError: null,
    onMessage: {
      addListener: jest.fn(),
    },
  },
  storage: {
    local: {
      set: jest.fn((obj, cb) => cb?.()),
      get: jest.fn((keys, cb) => cb({})),
    },
  },
};
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';

describe('payment-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockClear();
  });

  describe('initiateCheckout', () => {
    it('should fail if user ID is missing', async () => {
      const result = await paymentService.initiateCheckout(null);
      expect(result).toBeNull();
    });

    it('should create checkout session and open tab', async () => {
      const mockSessionUrl = 'https://checkout.stripe.com/pay/cs_test_123';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessionUrl: mockSessionUrl }),
      });

      const result = await paymentService.initiateCheckout('user-123');

      expect(result).toBe(mockSessionUrl);
      // @ts-ignore
      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: mockSessionUrl });
    });

    it('should handle fetch errors gracefully', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await paymentService.initiateCheckout('user-123');
      expect(result).toBeNull();
    });
  });

  describe('redirectToCustomerPortal', () => {
    it('should fail if user ID is missing', async () => {
      const result = await paymentService.redirectToCustomerPortal(null);
      expect(result).toBe(false);
    });

    it('should open customer portal in new tab', async () => {
      const mockPortalUrl = 'https://billing.stripe.com/portal/session/test';

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ portalUrl: mockPortalUrl }),
      });

      const result = await paymentService.redirectToCustomerPortal('user-123');

      expect(result).toBe(true);
      // @ts-ignore
      expect(chrome.tabs.create).toHaveBeenCalledWith({ url: mockPortalUrl });
    });
  });

  describe('handleCheckoutSuccess', () => {
    it('should fail if user ID or session ID is missing', async () => {
      const result = await paymentService.handleCheckoutSuccess(null, 'session-123');
      expect(result).toBe(false);
    });

    it('should verify session and update cache', async () => {
      const mockTrialEndDate = '2026-03-13T00:00:00Z';

      global.fetch = jest.fn(() =>
          Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ trial_end_date: mockTrialEndDate }),
          })
        );

        const result = await paymentService.handleCheckoutSuccess('user-123', 'session-123');

      expect(result).toBe(true);
      // @ts-ignore
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('isStripeConfigured', () => {
    it('should return false when Stripe key is not set', () => {
      delete process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
      expect(paymentService.isStripeConfigured()).toBe(false);
    });

    it('should return true when Stripe key is configured', () => {
      process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
      expect(paymentService.isStripeConfigured()).toBe(true);
    });
  });
});
