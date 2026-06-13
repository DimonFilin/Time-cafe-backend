/** Exact journal descriptions from Полное-задание.txt (session 2, task 1). */

export const IMPORT_FIELD_CAFE = 'Заведение регистрации клиента';
export const IMPORT_FIELD_NAME = 'Имя';
export const IMPORT_FIELD_PHONE = 'Номер телефона';
export const IMPORT_FIELD_SCUD = 'СКУД';

export const IMPORT_ERROR = {
  duplicatePhoneInFile: 'Дубликат по номеру телефона.',
  duplicatePhoneInDb: 'Номер телефона уже существует в базе.',
  duplicateScudInFile: 'Дубликат по ID СКУД.',
  duplicateScudInDb:
    'Идентификатор карты СКУД уже используется другим клиентом.',
  missingField: (fieldName: string) =>
    `Отсутствует обязательное поле ${fieldName}`,
  invalidPhone: 'Некорректный номер телефона',
  invalidScud: 'Некорректный номер СКУД',
} as const;

export const IMPORT_WARNING = {
  invalidEmail: 'Некорректный email',
  invalidBirthDate: 'Некорректная дата рождения',
  invalidGender: 'Некорректное значение пола',
} as const;
