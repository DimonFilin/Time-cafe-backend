/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
// Jest setup file for e2e tests
import { jest } from '@jest/globals';

// Global type declarations for test helpers
declare global {
  var testRetry: <T>(
    fn: () => Promise<T>,
    maxRetries?: number,
    delay?: number,
  ) => Promise<T>;
}

// Increase timeout for all tests
jest.setTimeout(60000);

// Global retry helper for API calls
global.testRetry = async (
  fn: () => Promise<any>,
  maxRetries = 3,
  delay = 1000,
) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (i === maxRetries - 1) throw error;
      if (
        error.message?.includes('Invalid refresh token') ||
        error.message?.includes('Login failed') ||
        error.message?.includes('Unauthorized')
      ) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
};

// Mock console methods to reduce noise in test output
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  // Filter out common Keycloak token refresh errors during tests
  if (
    args.some(
      (arg) => typeof arg === 'string' && arg.includes('Invalid refresh token'),
    )
  ) {
    return;
  }
  if (
    args.some((arg) => typeof arg === 'string' && arg.includes('Login failed'))
  ) {
    return;
  }
  originalConsoleError(...args);
};
