export const PASS = {
  user: 'User2026!',
  worker: 'Worker2026!',
  admin: 'Admin2026!',
  multiacc: 'MultiAccount2026!',
} as const;

export const IMG = {
  cafe: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
  cafe2: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800',
  cafe3: 'https://images.unsplash.com/photo-1453614512568-c1564f21409a?w=800',
  logoA: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=200',
  logoB: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=200',
  drink: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400',
  snack: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400',
  room: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600',
  avatar: 'https://i.pravatar.cc/150?img=',
  review: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600',
} as const;

export const ACCOUNTS = {
  multiacc: {
    email: 'multiacc.email@gmail.com',
    password: PASS.multiacc,
  },
  systemAdmin: {
    email: 'admin@timecafe.by',
    password: PASS.admin,
    firstName: 'Алексей',
    lastName: 'Системов',
  },
  minsk2: {
    admin: {
      email: 'admin.minsk2@cafe.by',
      password: PASS.admin,
      firstName: 'Ольга',
      lastName: 'Минская',
    },
    worker: {
      email: 'worker.minsk2@cafe.by',
      password: PASS.worker,
      firstName: 'Дмитрий',
      lastName: 'Бариста',
    },
  },
  brest: {
    admin: {
      email: 'admin.brest@cafe.by',
      password: PASS.admin,
      firstName: 'Ирина',
      lastName: 'Брестская',
    },
    worker: {
      email: 'worker.brest@cafe.by',
      password: PASS.worker,
      firstName: 'Павел',
      lastName: 'Хост',
    },
  },
  users: [
    {
      key: 'acc1' as const,
      email: 'user.acc1@gmail.com',
      firstName: 'Анна',
      lastName: 'Коваль',
      phone: '+375-29-111-11-11',
      tier: 'bronze' as const,
    },
    {
      key: 'acc2' as const,
      email: 'user.acc2@gmail.com',
      firstName: 'Сергей',
      lastName: 'Левченко',
      phone: '+375-29-222-22-22',
      tier: 'silver' as const,
    },
    {
      key: 'acc3' as const,
      email: 'user.acc3@gmail.com',
      firstName: 'Елена',
      lastName: 'Громова',
      phone: '+375-29-333-33-33',
      tier: 'gold' as const,
    },
  ],
};

export const OPENING_HOURS = {
  mon: { open: '10:00', close: '23:00' },
  tue: { open: '10:00', close: '23:00' },
  wed: { open: '10:00', close: '23:00' },
  thu: { open: '10:00', close: '23:00' },
  fri: { open: '10:00', close: '01:00' },
  sat: { open: '11:00', close: '01:00' },
  sun: { open: '11:00', close: '22:00' },
};
