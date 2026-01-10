// Global type declarations for test environment
declare global {
  // Retry helper for API calls
  var testRetry: <T>(
    fn: () => Promise<T>,
    maxRetries?: number,
    delay?: number,
  ) => Promise<T>;

  // Test request helper
  var createTestRequest: (app: any) => TestRequestHelper;

  // Global test request instance
  var testRequest: any;
}

// Test utility types
export interface TestUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  keycloakId: string;
}

export interface TestBrand {
  id: string;
  name: string;
  email: string;
  status: string;
  isVerified: boolean;
}

export interface TestCafe {
  id: string;
  name: string;
  address: string;
  brandId: string;
  regionId: string;
}

export interface TestOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
}

export interface TestAppointment {
  id: string;
  status: string;
  dateTime: Date;
  duration: number;
}

// API Response types for testing
export interface ApiResponse<T = any> {
  status: number;
  body: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Test context type
export interface TestContext {
  app: any;
  prisma: any;
  keycloakService: any;
}

// Helper type for Prisma findMany results
export type PrismaFindManyResult<T> = T[];

// Helper type for request response
export type RequestResponse = {
  status: number;
  body: any;
  headers: Record<string, string>;
};

// Test request helper - simplified for test files
export type TestRequestHelper = {
  post: (url: string) => any;
  get: (url: string) => any;
  patch: (url: string) => any;
  delete: (url: string) => any;
};
