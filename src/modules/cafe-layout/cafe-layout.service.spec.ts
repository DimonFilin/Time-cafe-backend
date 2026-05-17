import { WorkerRole } from '@prisma/client';
import { CafeLayoutService } from './cafe-layout.service';

function makeSaveEditorStateMocks() {
  const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const tx = {
    cafeLayout: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'L1',
        title: 'Main',
        schema: {},
        previewUrl: null,
        isPublished: false,
        updatedAt: new Date(),
      }),
      update: jest.fn().mockImplementation((args) => ({ ...args.data, id: args.where.id })),
      create: jest.fn(),
    },
    cafeRoom: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    cafeLayoutElement: {
      deleteMany,
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
      create: jest.fn(),
    },
    cafeRoomAsset: { update: jest.fn(), create: jest.fn() },
    cafeSharedAsset: { update: jest.fn(), create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
    cafe: {
      findUnique: jest.fn().mockResolvedValue({ id: 'cafe-1', brandId: 'brand-1' }),
    },
    cafeLayout: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    cafeRoom: { findMany: jest.fn().mockResolvedValue([]) },
    cafeLayoutElement: { findMany: jest.fn().mockResolvedValue([]) },
    cafeRoomAsset: { findMany: jest.fn().mockResolvedValue([]) },
    cafeSharedAsset: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;
  const workersService = {
    findByKeycloakId: jest.fn().mockResolvedValue({
      id: 'w1',
      keycloakId: 'k1',
      email: 'a@b.c',
      role: WorkerRole.CAFE_ADMIN,
      cafeId: 'cafe-1',
      brandId: null,
    }),
  };
  const activityLogsService = { log: jest.fn().mockResolvedValue(undefined) };
  return { prisma, workersService, activityLogsService, tx, deleteMany };
}

describe('CafeLayoutService', () => {
  it('calculates cafe occupancy percentage by room capacity', async () => {
    const prisma = {
      cafeRoom: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'r1', name: 'Room 1', capacity: 4 },
          { id: 'r2', name: 'Room 2', capacity: 6 },
        ]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a1', roomId: 'r1', dateTime: new Date(), duration: 60, status: 'confirmed' },
          { id: 'a2', roomId: 'r2', dateTime: new Date(), duration: 60, status: 'pending' },
          { id: 'a3', roomId: 'r2', dateTime: new Date(), duration: 60, status: 'completed' },
        ]),
      },
    } as any;
    const service = new CafeLayoutService(prisma, {} as any, {} as any);

    const result = await service.getOccupancyDay('cafe-1', '2026-05-13');

    expect(result.totalCapacity).toBe(10);
    expect(result.totalAppointments).toBe(3);
    expect(result.occupancyPercent).toBe(30);
    expect(result.rooms).toHaveLength(2);
  });

  it('returns range occupancy with average of daily percents', async () => {
    const prisma = {
      cafeRoom: {
        findMany: jest.fn().mockResolvedValue([{ id: 'r1', name: 'Room 1', capacity: 10 }]),
      },
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a1',
            roomId: 'r1',
            dateTime: new Date('2026-05-13T12:00:00.000Z'),
            duration: 60,
            status: 'confirmed',
          },
          {
            id: 'a2',
            roomId: 'r1',
            dateTime: new Date('2026-05-14T12:00:00.000Z'),
            duration: 60,
            status: 'confirmed',
          },
        ]),
      },
    } as any;
    const service = new CafeLayoutService(prisma, {} as any, {} as any);

    const result = await service.getOccupancy('cafe-1', { from: '2026-05-13', to: '2026-05-14' });

    if (!('mode' in result) || result.mode !== 'range') {
      throw new Error('expected range occupancy');
    }
    expect(result.days).toHaveLength(2);
    expect(result.days[0].occupancyPercent).toBe(10);
    expect(result.days[1].occupancyPercent).toBe(10);
    expect(result.summary.avgOccupancyPercent).toBe(10);
  });

  it('saveEditorState removes WALL/ROOM_ZONE missing from payload (notIn)', async () => {
    const m = makeSaveEditorStateMocks();
    const service = new CafeLayoutService(
      m.prisma,
      m.workersService as any,
      m.activityLogsService as any,
    );

    await service.saveEditorState('cafe-1', 'k1', {
      elements: [
        {
          id: 'wall-keep',
          elementType: 'WALL',
          geometry: { x1: 0, y1: 0, x2: 10, y2: 0 },
        },
      ],
    });

    expect(m.deleteMany).toHaveBeenCalledWith({
      where: {
        cafeId: 'cafe-1',
        elementType: {
          in: [
            'WALL',
            'ROOM_ZONE',
            'TABLE',
            'CHAIR',
            'WINDOW',
            'DOOR',
            'STAIR',
            'SOFA',
            'TOILET',
            'SINK',
            'CABINET',
            'TV',
            'WHITEBOARD',
          ],
        },
        id: { notIn: ['wall-keep'] },
      },
    });
  });

  it('saveEditorState removes rooms missing from payload (notIn)', async () => {
    const m = makeSaveEditorStateMocks();
    const service = new CafeLayoutService(
      m.prisma,
      m.workersService as any,
      m.activityLogsService as any,
    );

    await service.saveEditorState('cafe-1', 'k1', {
      rooms: [{ id: 'room-keep', name: 'Зал', capacity: 4 }],
    });

    expect(m.tx.cafeRoom.deleteMany).toHaveBeenCalledWith({
      where: { cafeId: 'cafe-1', id: { notIn: ['room-keep'] } },
    });
  });

  it('saveEditorState deletes all cafe rooms when payload rooms is empty', async () => {
    const m = makeSaveEditorStateMocks();
    const service = new CafeLayoutService(
      m.prisma,
      m.workersService as any,
      m.activityLogsService as any,
    );

    await service.saveEditorState('cafe-1', 'k1', { rooms: [] });

    expect(m.tx.cafeRoom.deleteMany).toHaveBeenCalledWith({
      where: { cafeId: 'cafe-1' },
    });
  });

  it('saveEditorState deletes all WALL/ROOM_ZONE when payload has no geometry ids', async () => {
    const m = makeSaveEditorStateMocks();
    const service = new CafeLayoutService(
      m.prisma,
      m.workersService as any,
      m.activityLogsService as any,
    );

    await service.saveEditorState('cafe-1', 'k1', {
      elements: [
        {
          elementType: 'WALL',
          geometry: { x1: 0, y1: 0, x2: 10, y2: 0 },
        },
      ],
    });

    expect(m.deleteMany).toHaveBeenCalledWith({
      where: {
        cafeId: 'cafe-1',
        elementType: {
          in: [
            'WALL',
            'ROOM_ZONE',
            'TABLE',
            'CHAIR',
            'WINDOW',
            'DOOR',
            'STAIR',
            'SOFA',
            'TOILET',
            'SINK',
            'CABINET',
            'TV',
            'WHITEBOARD',
          ],
        },
      },
    });
  });
});

