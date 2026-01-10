// Common API types used across the application

// Generic API response wrapper
export interface ApiResponse<T = any> {
  status: number;
  data: T;
  message?: string;
}

// Paginated response
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Error response
export interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
}

// Common entity interfaces (for cases where we need to bypass Prisma types)
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// User related types
export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
}

// Order status enum (to avoid importing from Prisma in multiple places)
export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PREPARING = 'PREPARING',
  READY = 'READY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Appointment status enum
export enum AppointmentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

// Payment method enum
export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BALANCE = 'BALANCE',
}

// Worker role enum
export enum WorkerRole {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  BRAND_ADMIN = 'BRAND_ADMIN',
  CAFE_ADMIN = 'CAFE_ADMIN',
  WORKER = 'WORKER',
}

// Brand status enum
export enum BrandStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  SUSPENDED = 'SUSPENDED',
}

// Helper types for Prisma operations (to reduce unsafe usage)
export type PrismaFindResult<T> = T | null;
export type PrismaFindManyResult<T> = T[];
export type PrismaCreateResult<T> = T;
export type PrismaUpdateResult<T> = T;

// Generic service response types
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Validation result type
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
}

// Cache key types for better type safety
export type CacheKey = string;
export type CacheTTL = number;

// File upload types
export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

// Geocoding types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodeResult {
  coordinates: Coordinates;
  address: string;
}

export interface ReverseGeocodeResult {
  address: string;
  components: {
    street?: string;
    city?: string;
    region?: string;
    country?: string;
    postalCode?: string;
  };
}

// Review related types
export interface ReviewResponse {
  id: string;
  rating: number;
  comment?: string;
  pros?: string[];
  cons?: string[];
  cafeId: string;
  userId: string;
  orderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReviewRequest {
  cafeId: string;
  rating: number;
  comment?: string;
  pros?: string[];
  cons?: string[];
  orderId?: string;
}

export interface ReviewListQuery {
  cafeId?: string;
  minRating?: number;
  page?: number;
  limit?: number;
}

// Prisma result types for type-safe operations
export interface PrismaOrderResult {
  id: string;
  orderNumber: string;
  userId: string;
  cafeId: string;
  status: string;
  totalAmount: any; // Prisma.Decimal
  deliveryType: string;
  contactPhone: string;
  paymentMethod: string;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  items?: any[];
}

export interface PrismaReviewResult {
  id: string;
  rating: number;
  comment?: string | null;
  pros?: string[] | null;
  cons?: string[] | null;
  cafeId: string;
  userId: string;
  orderId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

// Type guards for Prisma results
export function isPrismaOrderResult(obj: unknown): obj is PrismaOrderResult {
  const o = obj as Record<string, unknown>;
  return (
    o !== null &&
    typeof o === 'object' &&
    typeof o.id === 'string' &&
    typeof o.orderNumber === 'string'
  );
}

export function isPrismaReviewResult(obj: unknown): obj is PrismaReviewResult {
  const o = obj as Record<string, unknown>;
  return (
    o !== null &&
    typeof o === 'object' &&
    typeof o.id === 'string' &&
    typeof o.rating === 'number'
  );
}
