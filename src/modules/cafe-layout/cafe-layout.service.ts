import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActivityCategory,
  Prisma,
  WorkerRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersService } from '../workers/workers.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import { billingModesAvailable, parseRoomBilling } from './room-billing.util';
import { buildPlanRasterImage } from './plan-preview-raster.util';
import {
  buildPlanPreviewPayload,
  planPreviewForClient,
} from './plan-preview.util';

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type EditorPayload = {
  layout?: {
    title?: string;
    schema?: unknown;
    previewUrl?: string | null;
    isPublished?: boolean;
  };
  rooms?: Array<{
    id?: string;
    name: string;
    description?: string;
    imageUrl?: string;
    capacity?: number;
    workingHours?: unknown;
    geometry?: unknown;
    status?: string;
    metadata?: unknown;
  }>;
  elements?: Array<{
    id?: string;
    roomId?: string | null;
    elementType: string;
    name?: string;
    geometry: unknown;
    props?: unknown;
    isOpen?: boolean;
    description?: string;
  }>;
  roomAssets?: Array<{
    id?: string;
    roomId: string;
    name: string;
    description?: string;
    quantity?: number;
    isActive?: boolean;
    metadata?: unknown;
  }>;
  sharedAssets?: Array<{
    id?: string;
    name: string;
    description?: string;
    totalQuantity?: number;
    isActive?: boolean;
    metadata?: unknown;
  }>;
};

@Injectable()
export class CafeLayoutService {
  private readonly logger = new Logger(CafeLayoutService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly workersService: WorkersService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  private async assertAccess(cafeId: string, keycloakId: string) {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) throw new ForbiddenException('Worker not found');
    if (worker.role === WorkerRole.SYSTEM_ADMIN) return worker;
    const cafe = await this.prisma.cafe.findUnique({
      where: { id: cafeId },
      select: { id: true, brandId: true },
    });
    if (!cafe) throw new NotFoundException('Cafe not found');
    if (
      worker.role === WorkerRole.BRAND_ADMIN &&
      worker.brandId === cafe.brandId
    ) {
      return worker;
    }
    if (
      (worker.role === WorkerRole.CAFE_ADMIN ||
        worker.role === WorkerRole.WORKER) &&
      worker.cafeId === cafeId
    ) {
      return worker;
    }
    throw new ForbiddenException('No access to cafe layout');
  }

  async getEditorState(cafeId: string, keycloakId: string) {
    await this.assertAccess(cafeId, keycloakId);
    const [layout, rooms, elements, roomAssets, sharedAssets] =
      await Promise.all([
        this.prisma.cafeLayout.findFirst({
          where: { cafeId },
          orderBy: [{ isPublished: 'desc' }, { updatedAt: 'desc' }],
        }),
        this.prisma.cafeRoom.findMany({
          where: { cafeId },
          orderBy: { name: 'asc' },
        }),
        this.prisma.cafeLayoutElement.findMany({
          where: { cafeId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.cafeRoomAsset.findMany({
          where: { cafeId },
          orderBy: { createdAt: 'asc' },
        }),
        this.prisma.cafeSharedAsset.findMany({
          where: { cafeId },
          orderBy: { createdAt: 'asc' },
        }),
      ]);
    return { layout, rooms, elements, roomAssets, sharedAssets };
  }

  async saveEditorState(
    cafeId: string,
    keycloakId: string,
    payload: EditorPayload,
  ) {
    const worker = await this.assertAccess(cafeId, keycloakId);
    if (
      !payload.layout &&
      !payload.rooms &&
      !payload.elements &&
      !payload.roomAssets &&
      !payload.sharedAssets
    ) {
      throw new BadRequestException('Empty payload');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let layout = await tx.cafeLayout.findFirst({
        where: { cafeId },
        orderBy: { updatedAt: 'desc' },
      });

      if (payload.layout) {
        const data = {
          title: payload.layout.title ?? layout?.title ?? 'Основная планировка',
          schema: toInputJson(payload.layout.schema ?? layout?.schema ?? {}),
          previewUrl: payload.layout.previewUrl ?? null,
          isPublished:
            payload.layout.isPublished ?? layout?.isPublished ?? false,
          createdById: worker.id,
        };
        if (layout) {
          layout = await tx.cafeLayout.update({
            where: { id: layout.id },
            data,
          });
        } else {
          layout = await tx.cafeLayout.create({
            data: { cafeId, version: 1, ...data },
          });
        }
      }

      if (payload.rooms) {
        const keptRoomIds = payload.rooms
          .map((room) => room.id)
          .filter((id): id is string => Boolean(id));
        if (keptRoomIds.length === 0) {
          await tx.cafeRoom.deleteMany({ where: { cafeId } });
        } else {
          await tx.cafeRoom.deleteMany({
            where: { cafeId, id: { notIn: keptRoomIds } },
          });
        }

        for (const room of payload.rooms) {
          const data = {
            cafeId,
            name: room.name,
            description: room.description,
            imageUrl: room.imageUrl,
            capacity: room.capacity ?? 0,
            workingHours:
              room.workingHours != null
                ? toInputJson(room.workingHours)
                : undefined,
            geometry:
              room.geometry != null ? toInputJson(room.geometry) : undefined,
            status: room.status ?? 'ACTIVE',
            metadata:
              room.metadata != null ? toInputJson(room.metadata) : undefined,
          };
          if (room.id) {
            const existing = await tx.cafeRoom.findFirst({
              where: { id: room.id, cafeId },
            });
            if (existing) {
              await tx.cafeRoom.update({ where: { id: room.id }, data });
            } else {
              await tx.cafeRoom.create({ data: { ...data, id: room.id } });
            }
          } else {
            await tx.cafeRoom.create({ data });
          }
        }
      }

      if (payload.elements) {
        const geometryTypes = [
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
        ] as const;
        const keptIds = payload.elements
          .filter(
            (el) =>
              el.id &&
              (el.elementType === 'WALL' ||
                el.elementType === 'ROOM_ZONE' ||
                el.elementType === 'TABLE' ||
                el.elementType === 'CHAIR' ||
                el.elementType === 'WINDOW' ||
                el.elementType === 'DOOR' ||
                el.elementType === 'STAIR' ||
                el.elementType === 'SOFA' ||
                el.elementType === 'TOILET' ||
                el.elementType === 'SINK' ||
                el.elementType === 'CABINET' ||
                el.elementType === 'TV' ||
                el.elementType === 'WHITEBOARD'),
          )
          .map((el) => el.id as string);
        if (keptIds.length === 0) {
          await tx.cafeLayoutElement.deleteMany({
            where: {
              cafeId,
              elementType: { in: [...geometryTypes] },
            },
          });
        } else {
          await tx.cafeLayoutElement.deleteMany({
            where: {
              cafeId,
              elementType: { in: [...geometryTypes] },
              id: { notIn: keptIds },
            },
          });
        }

        for (const el of payload.elements) {
          const data = {
            cafeId,
            roomId: el.roomId ?? null,
            elementType: el.elementType,
            name: el.name,
            geometry: toInputJson(el.geometry),
            props: el.props != null ? toInputJson(el.props) : undefined,
            isOpen: el.isOpen,
            description: el.description,
            createdById: worker.id,
          };
          if (el.id) {
            const existing = await tx.cafeLayoutElement.findFirst({
              where: { id: el.id, cafeId },
            });
            if (existing) {
              await tx.cafeLayoutElement.update({ where: { id: el.id }, data });
            } else {
              await tx.cafeLayoutElement.create({
                data: { ...data, id: el.id },
              });
            }
          } else {
            await tx.cafeLayoutElement.create({ data });
          }
        }
      }

      if (payload.roomAssets) {
        for (const asset of payload.roomAssets) {
          const data = {
            cafeId,
            roomId: asset.roomId,
            name: asset.name,
            description: asset.description,
            quantity: asset.quantity ?? 1,
            isActive: asset.isActive ?? true,
            metadata:
              asset.metadata != null ? toInputJson(asset.metadata) : undefined,
          };
          if (asset.id) {
            await tx.cafeRoomAsset.update({ where: { id: asset.id }, data });
          } else {
            await tx.cafeRoomAsset.create({ data });
          }
        }
      }

      if (payload.sharedAssets) {
        for (const asset of payload.sharedAssets) {
          const data = {
            cafeId,
            name: asset.name,
            description: asset.description,
            totalQuantity: asset.totalQuantity ?? 1,
            isActive: asset.isActive ?? true,
            metadata:
              asset.metadata != null ? toInputJson(asset.metadata) : undefined,
          };
          if (asset.id) {
            await tx.cafeSharedAsset.update({ where: { id: asset.id }, data });
          } else {
            await tx.cafeSharedAsset.create({ data });
          }
        }
      }

      return layout;
    });

    await this.activityLogsService.log({
      workerId: worker.id,
      workerEmail: worker.email,
      workerRole: worker.role,
      brandId: worker.brandId ?? undefined,
      cafeId,
      action: ActivityAction.UPDATE,
      category: ActivityCategory.DATA,
      resourceType: 'CAFE_LAYOUT',
      resourceId: result?.id,
      details: {
        changed: {
          layout: Boolean(payload.layout),
          rooms: payload.rooms?.length ?? 0,
          elements: payload.elements?.length ?? 0,
          roomAssets: payload.roomAssets?.length ?? 0,
          sharedAssets: payload.sharedAssets?.length ?? 0,
        },
      },
    });

    return this.getEditorState(cafeId, keycloakId);
  }

  private buildOccupancyDayPayload(
    dateYmd: string,
    rooms: Array<{ id: string; name: string; capacity: number }>,
    appointments: Array<{
      id: string;
      roomId: string | null;
      dateTime: Date;
      duration: number;
      status: string;
    }>,
  ) {
    const byRoom = rooms.map((room) => {
      const roomAppointments = appointments.filter((a) => a.roomId === room.id);
      return {
        roomId: room.id,
        roomName: room.name,
        appointmentsCount: roomAppointments.length,
        capacity: room.capacity,
        occupancyPercent:
          room.capacity > 0
            ? Math.min(
                100,
                Math.round((roomAppointments.length / room.capacity) * 100),
              )
            : 0,
      };
    });

    const totalCapacity = rooms.reduce(
      (sum, r) => sum + Math.max(0, r.capacity),
      0,
    );
    const totalAppointments = appointments.length;

    return {
      date: dateYmd,
      totalCapacity,
      totalAppointments,
      occupancyPercent:
        totalCapacity > 0
          ? Math.min(100, Math.round((totalAppointments / totalCapacity) * 100))
          : 0,
      rooms: byRoom,
    };
  }

  async getOccupancyDay(cafeId: string, dateYmd: string) {
    const start = new Date(`${dateYmd}T00:00:00.000Z`);
    const end = new Date(`${dateYmd}T23:59:59.999Z`);
    const [rooms, appointments] = await Promise.all([
      this.prisma.cafeRoom.findMany({ where: { cafeId, status: 'ACTIVE' } }),
      this.prisma.appointment.findMany({
        where: {
          cafeId,
          status: { in: ['pending', 'confirmed', 'completed'] },
          dateTime: { gte: start, lte: end },
        },
        select: {
          id: true,
          roomId: true,
          dateTime: true,
          duration: true,
          status: true,
        },
      }),
    ]);

    return this.buildOccupancyDayPayload(dateYmd, rooms, appointments);
  }

  async getOccupancy(
    cafeId: string,
    query: { date?: string; from?: string; to?: string },
  ) {
    const from = query.from?.trim();
    const to = query.to?.trim();
    if ((from && !to) || (!from && to)) {
      throw new BadRequestException('from and to must be provided together');
    }
    if (from && to) {
      if (from > to) {
        throw new BadRequestException('from must be <= to');
      }
      const rangeStart = new Date(`${from}T00:00:00.000Z`);
      const rangeEnd = new Date(`${to}T23:59:59.999Z`);
      let dayCount = 0;
      for (
        let d = new Date(rangeStart);
        d <= rangeEnd;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        dayCount += 1;
        if (dayCount > 31) {
          throw new BadRequestException('date range must be at most 31 days');
        }
      }

      const [rooms, appointments] = await Promise.all([
        this.prisma.cafeRoom.findMany({ where: { cafeId, status: 'ACTIVE' } }),
        this.prisma.appointment.findMany({
          where: {
            cafeId,
            status: { in: ['pending', 'confirmed', 'completed'] },
            dateTime: { gte: rangeStart, lte: rangeEnd },
          },
          select: {
            id: true,
            roomId: true,
            dateTime: true,
            duration: true,
            status: true,
          },
        }),
      ]);

      const days: string[] = [];
      for (
        let d = new Date(rangeStart);
        d <= rangeEnd;
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        days.push(d.toISOString().slice(0, 10));
      }

      const dayRows = days.map((ymd) => {
        const ds = new Date(`${ymd}T00:00:00.000Z`);
        const de = new Date(`${ymd}T23:59:59.999Z`);
        const apps = appointments.filter(
          (a) => a.dateTime >= ds && a.dateTime <= de,
        );
        return this.buildOccupancyDayPayload(ymd, rooms, apps);
      });

      const avgOccupancyPercent = dayRows.length
        ? Math.round(
            dayRows.reduce((s, row) => s + row.occupancyPercent, 0) /
              dayRows.length,
          )
        : 0;

      return {
        mode: 'range' as const,
        from,
        to,
        days: dayRows.map((d) => ({
          date: d.date,
          occupancyPercent: d.occupancyPercent,
          totalAppointments: d.totalAppointments,
          totalCapacity: d.totalCapacity,
        })),
        summary: { avgOccupancyPercent, dayCount: dayRows.length },
      };
    }

    const dateYmd = query.date?.trim() || new Date().toISOString().slice(0, 10);
    return this.getOccupancyDay(cafeId, dateYmd);
  }

  private readPlanBackgroundFromSchema(schema: unknown) {
    const root =
      schema && typeof schema === 'object' && schema !== null
        ? (schema as Record<string, unknown>)
        : null;
    const raw = root?.planBackgroundImage;
    if (!raw || typeof raw !== 'object' || raw === null) return null;
    const m = raw as Record<string, unknown>;
    const dataUrl = typeof m.dataUrl === 'string' ? m.dataUrl : '';
    if (!dataUrl.startsWith('data:image/')) return null;
    const x = Number(m.x);
    const y = Number(m.y);
    const widthM = Number(m.widthM);
    const heightM = Number(m.heightM);
    if (![x, y, widthM, heightM].every(Number.isFinite)) return null;
    return {
      dataUrl,
      x,
      y,
      widthM,
      heightM,
      opacity: Number(m.opacity) || 1,
    };
  }

  private readPlanFieldM(schema: unknown) {
    const root =
      schema && typeof schema === 'object' && schema !== null
        ? (schema as Record<string, unknown>)
        : null;
    const raw = root?.editorPlanFieldM;
    const m =
      raw && typeof raw === 'object' && raw !== null
        ? (raw as Record<string, unknown>)
        : null;
    return {
      widthM: Math.min(120, Math.max(2, Number(m?.widthM) || 6)),
      heightM: Math.min(120, Math.max(2, Number(m?.heightM) || 4)),
    };
  }

  async getPlanPreview(cafeId: string) {
    const [publishedLayout, latestLayout, elements, rooms] = await Promise.all([
      this.prisma.cafeLayout.findFirst({
        where: { cafeId, isPublished: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.cafeLayout.findFirst({
        where: { cafeId },
        orderBy: [{ isPublished: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.cafeLayoutElement.findMany({
        where: { cafeId },
        select: {
          id: true,
          elementType: true,
          geometry: true,
          props: true,
          name: true,
        },
      }),
      this.prisma.cafeRoom.findMany({
        where: { cafeId, status: 'ACTIVE' },
        select: { id: true, name: true },
      }),
    ]);
    const layout = publishedLayout ?? latestLayout;
    const roomNames = new Map(rooms.map((r) => [r.id, r.name]));
    const schema = layout?.schema;
    const preview = buildPlanPreviewPayload(
      elements,
      roomNames,
      this.readPlanFieldM(schema),
      this.readPlanBackgroundFromSchema(schema),
    );
    const hasGeometry =
      preview.zones.length > 0 ||
      preview.walls.length > 0 ||
      preview.furniture.length > 0 ||
      preview.openings.length > 0;
    const bgChars = preview.backgroundImage?.dataUrl?.length ?? 0;
    if (!hasGeometry) {
      this.logger.log(
        `[planPreview] cafe=${cafeId} empty geometry bgChars=${bgChars} -> null`,
      );
      return null;
    }
    const skipRaster =
      preview.walls.length > 0 ||
      preview.furniture.length > 0 ||
      preview.openings.length > 0;
    let raster: Awaited<ReturnType<typeof buildPlanRasterImage>> = null;
    if (!skipRaster) {
      try {
        raster = await buildPlanRasterImage(preview);
      } catch (err) {
        this.logger.warn(
          `[planPreview] cafe=${cafeId} raster failed: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    const client = planPreviewForClient(preview, raster);
    this.logger.log(
      `[planPreview] cafe=${cafeId} zones=${preview.zones.length} furniture=${preview.furniture.length} bgChars=${bgChars} raster=${raster ? `${raster.width}x${raster.height}~${Math.round(raster.dataUrl.length / 1024)}kb` : 'no'}`,
    );
    return client;
  }

  async getRoomAvailability(cafeId: string, dateYmd: string) {
    const start = new Date(`${dateYmd}T00:00:00.000Z`);
    const end = new Date(`${dateYmd}T23:59:59.999Z`);
    const [rooms, appointments, sharedAssets, planPreview] = await Promise.all([
      this.prisma.cafeRoom.findMany({
        where: { cafeId, status: 'ACTIVE' },
        orderBy: { name: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: {
          cafeId,
          status: { in: ['pending', 'confirmed'] },
          dateTime: { gte: start, lte: end },
        },
        select: { roomId: true, dateTime: true, duration: true },
      }),
      this.prisma.cafeSharedAsset.findMany({
        where: { cafeId, isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.getPlanPreview(cafeId),
    ]);

    const roomRows = rooms.map((room) => {
      const billing = parseRoomBilling(room.metadata);
      const billingModes = billingModesAvailable(billing);
      const slots = appointments
        .filter((a) => a.roomId === room.id)
        .map((a) => {
          const startAt = a.dateTime.toISOString();
          const endAt = new Date(
            a.dateTime.getTime() + a.duration * 60000,
          ).toISOString();
          return { startAt, endAt };
        });
      return {
        roomId: room.id,
        name: room.name,
        description: room.description,
        imageUrl: room.imageUrl,
        capacity: room.capacity,
        workingHours: room.workingHours,
        billing,
        billingModes,
        slots,
      };
    });
    const payload = {
      rooms: roomRows,
      sharedAssets: sharedAssets.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        totalQuantity: a.totalQuantity,
      })),
      planPreview,
    };
    const approxJson = JSON.stringify(payload).length;
    this.logger.log(
      `[roomAvailability] cafe=${cafeId} date=${dateYmd} rooms=${roomRows.length} plan=${planPreview ? 'yes' : 'no'} jsonChars≈${approxJson}`,
    );
    return payload;
  }
}
