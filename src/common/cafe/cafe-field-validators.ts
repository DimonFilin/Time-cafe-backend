import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/** Belarus (primary market): +375-XX-XXX-XX-XX */
export const CAFE_PHONE_REGEX_BY = /^\+375-\d{2}-\d{3}-\d{2}-\d{2}$/;
/** Russia: +7-XXX-XX-XX-XX */
export const CAFE_PHONE_REGEX_RU = /^\+7-\d{3}-\d{2}-\d{2}-\d{2}$/;
export const CAFE_PHONE_REGEX =
  /^(\+375-\d{2}-\d{3}-\d{2}-\d{2}|\+7-\d{3}-\d{2}-\d{2}-\d{2})$/;

export const CAFE_PHONE_FORMAT_HINT =
  'Phone: +375-XX-XXX-XX-XX (Belarus) or +7-XXX-XX-XX-XX (Russia)';

export const CAFE_OCCUPANCY_MODES = ['PERCENT', 'COUNT'] as const;
export type CafeOccupancyMode = (typeof CAFE_OCCUPANCY_MODES)[number];

export function isValidCafePhone(phone: string | null | undefined): boolean {
  if (phone === undefined || phone === null || phone === '') return true;
  const trimmed = phone.trim();
  return CAFE_PHONE_REGEX_BY.test(trimmed) || CAFE_PHONE_REGEX_RU.test(trimmed);
}

export function isValidCafeEmail(email: string | null | undefined): boolean {
  if (email === undefined || email === null || email === '') return true;
  return (email.match(/@/g) || []).length === 1;
}

@ValidatorConstraint({ name: 'isCafeEmail', async: false })
export class IsCafeEmailConstraint implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (value === undefined || value === null || value === '') return true;
    return typeof value === 'string' && isValidCafeEmail(value);
  }

  defaultMessage() {
    return 'Email must contain exactly one @ character';
  }
}

export function IsCafeEmail(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCafeEmailConstraint,
    });
  };
}

export function formatOccupancyDisplay(
  mode: CafeOccupancyMode,
  occupancyPercent: number,
  totalAppointments: number,
  totalCapacity: number,
): string {
  if (mode === 'COUNT') {
    return totalCapacity > 0
      ? `${totalAppointments}/${totalCapacity}`
      : String(totalAppointments);
  }
  return `${occupancyPercent}%`;
}
