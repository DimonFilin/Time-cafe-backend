export const DEMO_PASS = {
  user: 'DemoGuest2026!',
  worker: 'DemoWorker2026!',
  admin: 'DemoAdmin2026!',
} as const;

/** Unsplash / free stock — разные визуалы для брендов и кафе */
export const STOCK = {
  logos: [
    'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=256',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=256',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=256',
  ],
  cafes: [
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900',
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=900',
    'https://images.unsplash.com/photo-1453614512568-c1564f21409a?w=900',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=900',
    'https://images.unsplash.com/photo-1521014161876-62eb38b0d0f0?w=900',
    'https://images.unsplash.com/photo-1559926213-4b66f4577580?w=900',
    'https://images.unsplash.com/photo-1445112250600-c8661f0e4b8c?w=900',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900',
    'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=900',
    'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=900',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900',
  ],
  rooms: [
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=700',
    'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=700',
    'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=700',
  ],
  menuDrinks: [
    'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400',
    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400',
    'https://images.unsplash.com/photo-1544787219-0e2d9d7c43d8?w=400',
  ],
  menuFood: [
    'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400',
    'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400',
  ],
  avatars: [3, 8, 12, 15, 22, 28, 31, 44, 47, 52, 58, 61].map(
    (n) => `https://i.pravatar.cc/200?img=${n}`,
  ),
} as const;

export const OPENING_HOURS = {
  mon: { open: '10:00', close: '23:00' },
  tue: { open: '10:00', close: '23:00' },
  wed: { open: '10:00', close: '23:00' },
  thu: { open: '10:00', close: '23:00' },
  fri: { open: '10:00', close: '01:00' },
  sat: { open: '11:00', close: '01:00' },
  sun: { open: '11:00', close: '22:00' },
};

export type BrandDef = {
  key: string;
  name: string;
  description: string;
  website: string;
  phone: string;
  email: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoIdx: number;
};

export type CafeDef = {
  key: string;
  brandKey: string;
  regionKey: 'minsk' | 'brest' | 'gomel' | 'grodno' | 'vitebsk' | 'mogilev';
  name: string;
  description: string;
  address: string;
  city: string;
  street: string;
  lat: number;
  lng: number;
  phone: string;
  email: string;
  photoIdx: number;
  reviewTarget: number;
  roomName: string;
  capacity: number;
  equip: 'tv' | 'tv_stand' | 'whiteboard';
};

export const BRANDS: BrandDef[] = [
  {
    key: 'timecafe',
    name: 'ТаймКафе Беларусь',
    description:
      'Сеть антикафе с почасовой оплатой: тихие зоны для учёбы, переговорки и игровые комнаты. Работаем в крупных городах Беларуси.',
    website: 'https://timecafe.by',
    phone: '+375-17-200-10-10',
    email: 'hello@timecafe.by',
    primaryColor: '#2D6A4F',
    secondaryColor: '#40916C',
    accentColor: '#D8F3DC',
    logoIdx: 0,
  },
  {
    key: 'uyutny',
    name: 'Уютный Час',
    description:
      'Домашняя атмосфера, мягкий свет и чай в бесконечном доступе. Идеально для встреч с друзьями и спокойной работы.',
    website: 'https://uyutnychas.by',
    phone: '+375-162-55-00-00',
    email: 'info@uyutnychas.by',
    primaryColor: '#6F4E37',
    secondaryColor: '#A67B5B',
    accentColor: '#F5E6D3',
    logoIdx: 1,
  },
  {
    key: 'loft',
    name: 'КофеПауза Loft',
    description:
      'Лофтовые пространства с проекторами и настольными играми. Бронируйте комнату под вечеринку или коворкинг.',
    website: 'https://cofepause.by',
    phone: '+375-29-700-20-20',
    email: 'loft@cofepause.by',
    primaryColor: '#1D3557',
    secondaryColor: '#457B9D',
    accentColor: '#F1FAEE',
    logoIdx: 2,
  },
];

export const CAFES: CafeDef[] = [
  {
    key: 'nezavisimosti',
    brandKey: 'timecafe',
    regionKey: 'minsk',
    name: 'ТаймКафе — пр. Независимости',
    description:
      'Флагманская точка у метро: два этажа, переговорная «Берёза» и общий зал с панорамными окнами. Часто выбирают для демо и встреч.',
    address: 'пр-т Независимости, 95',
    city: 'Минск',
    street: 'пр-т Независимости',
    lat: 53.9173,
    lng: 27.5921,
    phone: '+375-17-310-11-01',
    email: 'nezavisimosti@timecafe.by',
    photoIdx: 0,
    reviewTarget: 420,
    roomName: 'Переговорная «Берёза»',
    capacity: 6,
    equip: 'whiteboard',
  },
  {
    key: 'oktyabrskaya',
    brandKey: 'timecafe',
    regionKey: 'minsk',
    name: 'ТаймКафе — ул. Октябрьская',
    description:
      'Компактное антикафе в центре: удобно забежать на час между парами или встречами.',
    address: 'ул. Октябрьская, 16',
    city: 'Минск',
    street: 'ул. Октябрьская',
    lat: 53.9025,
    lng: 27.5618,
    phone: '+375-17-310-11-02',
    email: 'oktyabrskaya@timecafe.by',
    photoIdx: 1,
    reviewTarget: 180,
    roomName: 'Зал «Октябрь»',
    capacity: 4,
    equip: 'tv',
  },
  {
    key: 'pobediteley',
    brandKey: 'timecafe',
    regionKey: 'minsk',
    name: 'ТаймКафе — пр. Победителей',
    description:
      'Семейный формат: детский уголок и тихая комната для фрилансеров.',
    address: 'пр-т Победителей, 84',
    city: 'Минск',
    street: 'пр-т Победителей',
    lat: 53.9382,
    lng: 27.4821,
    phone: '+375-17-310-11-03',
    email: 'pobediteley@timecafe.by',
    photoIdx: 2,
    reviewTarget: 95,
    roomName: 'Комната «Победа»',
    capacity: 5,
    equip: 'tv_stand',
  },
  {
    key: 'gomel_tc',
    brandKey: 'timecafe',
    regionKey: 'gomel',
    name: 'ТаймКафе — Гомель, Речицкий',
    description: 'Первая точка сети в Гомеле: рядом с ТРЦ, удобная парковка.',
    address: 'пр-т Речицкий, 5В',
    city: 'Гомель',
    street: 'пр-т Речицкий',
    lat: 52.4242,
    lng: 31.0143,
    phone: '+375-232-55-11-04',
    email: 'gomel@timecafe.by',
    photoIdx: 3,
    reviewTarget: 72,
    roomName: 'Зал «Южный»',
    capacity: 8,
    equip: 'whiteboard',
  },
  {
    key: 'brest_sov',
    brandKey: 'uyutny',
    regionKey: 'brest',
    name: 'Уютный Час — Советская',
    description:
      'Исторический центр Бреста: каминная зона и чайная карта из 40 сортов.',
    address: 'ул. Советская, 12',
    city: 'Брест',
    street: 'ул. Советская',
    lat: 52.0976,
    lng: 23.7341,
    phone: '+375-162-55-20-01',
    email: 'brest@uyutnychas.by',
    photoIdx: 4,
    reviewTarget: 310,
    roomName: 'Чайная «Советская»',
    capacity: 4,
    equip: 'tv_stand',
  },
  {
    key: 'grodno',
    brandKey: 'uyutny',
    regionKey: 'grodno',
    name: 'Уютный Час — Ожешко',
    description:
      'Тихий дворик у пешеходной улицы, много розеток у каждого стола.',
    address: 'ул. Ожешко, 38',
    city: 'Гродно',
    street: 'ул. Ожешко',
    lat: 53.6778,
    lng: 23.8298,
    phone: '+375-152-55-20-02',
    email: 'grodno@uyutnychas.by',
    photoIdx: 5,
    reviewTarget: 88,
    roomName: 'Комната «Дворик»',
    capacity: 3,
    equip: 'tv',
  },
  {
    key: 'vitebsk',
    brandKey: 'uyutny',
    regionKey: 'vitebsk',
    name: 'Уютный Час — Ленина',
    description:
      'Уютные диваны и мягкий свет — популярно у студентов политехники.',
    address: 'пр-т Ленина, 25',
    city: 'Витебск',
    street: 'пр-т Ленина',
    lat: 55.1904,
    lng: 30.2049,
    phone: '+375-212-55-20-03',
    email: 'vitebsk@uyutnychas.by',
    photoIdx: 6,
    reviewTarget: 64,
    roomName: 'Зал «Ленина»',
    capacity: 6,
    equip: 'whiteboard',
  },
  {
    key: 'mogilev',
    brandKey: 'uyutny',
    regionKey: 'mogilev',
    name: 'Уютный Час — Первомайская',
    description: 'Небольшая точка с домашней выпечкой и настольными играми.',
    address: 'ул. Первомайская, 44',
    city: 'Могилёв',
    street: 'ул. Первомайская',
    lat: 53.8962,
    lng: 30.3315,
    phone: '+375-222-55-20-04',
    email: 'mogilev@uyutnychas.by',
    photoIdx: 7,
    reviewTarget: 55,
    roomName: 'Зал «Первомайский»',
    capacity: 4,
    equip: 'tv',
  },
  {
    key: 'nemiga',
    brandKey: 'loft',
    regionKey: 'minsk',
    name: 'КофеПауза — Немига',
    description:
      'Лофт с кирпичными стенами: стриминг, PlayStation и большой экран.',
    address: 'ул. Немига, 40',
    city: 'Минск',
    street: 'ул. Немига',
    lat: 53.9056,
    lng: 27.5549,
    phone: '+375-29-700-30-01',
    email: 'nemiga@cofepause.by',
    photoIdx: 8,
    reviewTarget: 520,
    roomName: 'Лофт «Немига»',
    capacity: 10,
    equip: 'tv',
  },
  {
    key: 'brest_loft',
    brandKey: 'loft',
    regionKey: 'brest',
    name: 'КофеПауза — Московская',
    description:
      'Вечерние брони под кино и настолки: проектор и колонки в комнате.',
    address: 'ул. Московская, 224',
    city: 'Брест',
    street: 'ул. Московская',
    lat: 52.0875,
    lng: 23.6981,
    phone: '+375-29-700-30-02',
    email: 'brestloft@cofepause.by',
    photoIdx: 9,
    reviewTarget: 140,
    roomName: 'Кинозал «Московская»',
    capacity: 8,
    equip: 'tv_stand',
  },
  {
    key: 'gomel_loft',
    brandKey: 'loft',
    regionKey: 'gomel',
    name: 'КофеПауза — Советская',
    description: 'Молодёжная точка: коворкинг днём, вечеринки по выходным.',
    address: 'ул. Советская, 98',
    city: 'Гомель',
    street: 'ул. Советская',
    lat: 52.4312,
    lng: 31.0012,
    phone: '+375-29-700-30-03',
    email: 'gomeloft@cofepause.by',
    photoIdx: 10,
    reviewTarget: 780,
    roomName: 'Студия «Советская»',
    capacity: 12,
    equip: 'whiteboard',
  },
];

export const REVIEW_COMMENTS = [
  'Отличное место для работы — Wi‑Fi стабильный, розетки у каждого места.',
  'Бронировали переговорную на 3 часа, всё чисто и тихо.',
  'Бариста помог с заказом, чат в приложении удобный.',
  'Цены адекватные, чай и кофе в включённом времени.',
  'Пришли компанией шестеро — комната вместила всех.',
  'QR на входе сработал сразу, check-in на ресепшене быстрый.',
  'Иногда шумно в пятницу вечером, но в будни идеально.',
  'Понравился маркерная доска для мозгового штурма.',
  'Депозит пополнили на месте — бонусы начислились как обещали.',
  'Удобно бронировать с телефона, план зала понятный.',
  'Диваны уютные, провели весь день за ноутбуком.',
  'Проектор в комнате — смотрели презентацию клиенту.',
  'Персонал вежливый, помогли перенести бронь на час.',
  'Меню скромное, но для перекуса хватает.',
  'Вернёмся снова — атмосфера как дома.',
  'Детская зона на Победителей — спасение для родителей.',
  'Немного ждали подтверждения заказа, но вкусно.',
  'Лучшее антикафе в городе по соотношению цена/комфорт.',
  'Зал после уборки пахнет свежестью, видно что следят.',
  'Брали комнату с телевизором — для киновечера супер.',
];

export const MOBILE_USERS = [
  {
    key: 'maria',
    email: 'maria.demo@user.demo',
    firstName: 'Мария',
    lastName: 'Кравченко',
    phone: '+375-29-101-01-01',
    tier: 'gold' as const,
    avatarIdx: 0,
  },
  {
    key: 'ivan',
    email: 'ivan.demo@user.demo',
    firstName: 'Иван',
    lastName: 'Лисовский',
    phone: '+375-29-202-02-02',
    tier: 'silver' as const,
    avatarIdx: 1,
  },
  {
    key: 'olga',
    email: 'olga.demo@user.demo',
    firstName: 'Ольга',
    lastName: 'Жук',
    phone: '+375-33-303-03-03',
    tier: 'bronze' as const,
    avatarIdx: 2,
  },
  {
    key: 'dmitry',
    email: 'dmitry.demo@user.demo',
    firstName: 'Дмитрий',
    lastName: 'Савицкий',
    phone: '+375-44-404-04-04',
    tier: 'silver' as const,
    avatarIdx: 3,
  },
  {
    key: 'kate',
    email: 'kate.demo@user.demo',
    firstName: 'Екатерина',
    lastName: 'Мельник',
    phone: '+375-25-505-05-05',
    tier: 'gold' as const,
    avatarIdx: 4,
  },
];

/** 5 ролей одного бренда (ТаймКафе) — без мультиаккаунта */
export const TIMECAFE_CORE_WORKERS = [
  {
    email: 'admin.sys@timecafe.demo',
    password: DEMO_PASS.admin,
    firstName: 'Алексей',
    lastName: 'Системов',
    role: 'SYSTEM_ADMIN' as const,
    cafeKey: null as string | null,
  },
  {
    email: 'brand.chief@timecafe.demo',
    password: DEMO_PASS.admin,
    firstName: 'Наталья',
    lastName: 'Брендова',
    role: 'BRAND_ADMIN' as const,
    cafeKey: null,
  },
  {
    email: 'admin.nezavisimosti@timecafe.demo',
    password: DEMO_PASS.admin,
    firstName: 'Виктор',
    lastName: 'Кравцов',
    role: 'CAFE_ADMIN' as const,
    cafeKey: 'nezavisimosti',
  },
  {
    email: 'worker.anna@timecafe.demo',
    password: DEMO_PASS.worker,
    firstName: 'Анна',
    lastName: 'Бариста',
    role: 'WORKER' as const,
    cafeKey: 'nezavisimosti',
  },
  {
    email: 'worker.igor@timecafe.demo',
    password: DEMO_PASS.worker,
    firstName: 'Игорь',
    lastName: 'Сменный',
    role: 'WORKER' as const,
    cafeKey: 'nezavisimosti',
  },
];

export const EXTRA_WORKERS: {
  email: string;
  firstName: string;
  lastName: string;
  role: 'WORKER' | 'BRAND_ADMIN' | 'CAFE_ADMIN';
  brandKey: string;
  cafeKey: string;
}[] = [
  {
    email: 'worker.oktyabrskaya@timecafe.demo',
    firstName: 'Светлана',
    lastName: 'Октябрь',
    role: 'WORKER',
    brandKey: 'timecafe',
    cafeKey: 'oktyabrskaya',
  },
  {
    email: 'worker.pobediteley@timecafe.demo',
    firstName: 'Максим',
    lastName: 'Победа',
    role: 'WORKER',
    brandKey: 'timecafe',
    cafeKey: 'pobediteley',
  },
  {
    email: 'worker.gomel@timecafe.demo',
    firstName: 'Юлия',
    lastName: 'Гомель',
    role: 'WORKER',
    brandKey: 'timecafe',
    cafeKey: 'gomel_tc',
  },
  {
    email: 'brand@uyutny.demo',
    firstName: 'Ирина',
    lastName: 'Уютная',
    role: 'BRAND_ADMIN',
    brandKey: 'uyutny',
    cafeKey: 'brest_sov',
  },
  {
    email: 'worker.brest@uyutny.demo',
    firstName: 'Павел',
    lastName: 'Брестский',
    role: 'WORKER',
    brandKey: 'uyutny',
    cafeKey: 'brest_sov',
  },
  {
    email: 'worker.grodno@uyutny.demo',
    firstName: 'Алина',
    lastName: 'Гродненская',
    role: 'WORKER',
    brandKey: 'uyutny',
    cafeKey: 'grodno',
  },
  {
    email: 'worker.vitebsk@uyutny.demo',
    firstName: 'Никита',
    lastName: 'Витебский',
    role: 'WORKER',
    brandKey: 'uyutny',
    cafeKey: 'vitebsk',
  },
  {
    email: 'worker.mogilev@uyutny.demo',
    firstName: 'Татьяна',
    lastName: 'Могилёвская',
    role: 'WORKER',
    brandKey: 'uyutny',
    cafeKey: 'mogilev',
  },
  {
    email: 'brand@loft.demo',
    firstName: 'Кирилл',
    lastName: 'Лофтов',
    role: 'BRAND_ADMIN',
    brandKey: 'loft',
    cafeKey: 'nemiga',
  },
  {
    email: 'worker.nemiga@loft.demo',
    firstName: 'Артём',
    lastName: 'Немига',
    role: 'WORKER',
    brandKey: 'loft',
    cafeKey: 'nemiga',
  },
  {
    email: 'worker.brestloft@loft.demo',
    firstName: 'Дарья',
    lastName: 'Московская',
    role: 'WORKER',
    brandKey: 'loft',
    cafeKey: 'brest_loft',
  },
  {
    email: 'worker.gomeloft@loft.demo',
    firstName: 'Роман',
    lastName: 'Советский',
    role: 'WORKER',
    brandKey: 'loft',
    cafeKey: 'gomel_loft',
  },
];
