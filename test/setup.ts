// Jest setup file for e2e tests
import { jest } from '@jest/globals';
import request from 'supertest';
import './types/test-globals.d';

// Increase timeout for all tests
jest.setTimeout(60000);

// Global retry helper for API calls
global.testRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (i === maxRetries - 1) throw error;
      if (
        errorMessage.includes('Invalid refresh token') ||
        errorMessage.includes('Login failed') ||
        errorMessage.includes('Unauthorized')
      ) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  // This should never be reached, but TypeScript requires it
  throw new Error('Retry function failed unexpectedly');
};

// Mock console methods to reduce noise in test output
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  // Filter out common Keycloak token refresh errors during tests
  const errorMessages = args.filter(
    (arg): arg is string => typeof arg === 'string',
  );
  if (errorMessages.some((msg) => msg.includes('Invalid refresh token'))) {
    return;
  }
  if (errorMessages.some((msg) => msg.includes('Login failed'))) {
    return;
  }
  originalConsoleError(...args);
};

// Global test request helper
declare global {
  var testRequest: any;
}

// Global helper for creating test requests
global.createTestRequest = (app: any) => {
  const server = app.getHttpServer();
  return {
    post: (url: string) => request(server).post(url),
    get: (url: string) => request(server).get(url),
    patch: (url: string) => request(server).patch(url),
    delete: (url: string) => request(server).delete(url),
  };
};
