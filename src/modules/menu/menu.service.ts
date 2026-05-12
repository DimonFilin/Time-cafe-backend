import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkersService } from '../workers/workers.service';
import { ActivityLogsService } from '../activity-logs/activity-logs.service';
import {
  Prisma,
  WorkerRole,
  ActivityAction,
  ActivityCategory,
} from '@prisma/client';
import type { CafeMenuJsonV1Dto } from './dto/cafe-menu-json.dto';
import type { CafeMenuResponseDto } from './dto/cafe-menu-response.dto';
import type {
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  UpdateMenuCategoryDto,
  UpdateMenuItemDto,
} from './dto/menu-mutate.dto';

type MenuMode = 'merge' | 'replace';

function normalizeKey(value: string): string {
  return String(value ?? '').trim();
}

function normalizePrice(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint')
    return String(value);
  if (value instanceof Prisma.Decimal) return value.toString();
  return '';
}

@Injectable()
export class MenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workersService: WorkersService,
    private readonly activityLogsService: ActivityLogsService,
  ) {}

  private async assertCafeExists(cafeId: string) {
    const cafe = await this.prisma.cafe.findFirst({
      where: { id: cafeId, deletedAt: null },
      select: { id: true, brandId: true },
    });
    if (!cafe) throw new NotFoundException('Cafe not found');
    return cafe;
  }

  private async assertAdminAccessToCafe(cafeId: string, keycloakId: string) {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) throw new ForbiddenException('Worker account not found');

    if (worker.role === WorkerRole.SYSTEM_ADMIN) return;

    if (worker.role === WorkerRole.CAFE_ADMIN) {
      if (worker.cafeId === cafeId) return;
      throw new ForbiddenException(
        'CAFE_ADMIN can only access their assigned cafe',
      );
    }

    if (worker.role === WorkerRole.BRAND_ADMIN) {
      const cafe = await this.assertCafeExists(cafeId);
      if (worker.brandId && worker.brandId === cafe.brandId) return;
      throw new ForbiddenException(
        'BRAND_ADMIN can only access cafes of their brand',
      );
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  private async logMenuMutation(
    keycloakId: string,
    params: {
      action: ActivityAction;
      category: ActivityCategory;
      resourceType: string;
      resourceId?: string;
      details?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    const worker = await this.workersService.findByKeycloakId(keycloakId);
    if (!worker) return;
    await this.activityLogsService.log({
      workerId: worker.id,
      workerEmail: worker.email,
      workerRole: worker.role,
      brandId: worker.brandId ?? undefined,
      cafeId: worker.cafeId ?? undefined,
      action: params.action,
      category: params.category,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      details: params.details,
    });
  }

  private mapMenu(
    cafeId: string,
    rows: Array<{
      id: string;
      key: string;
      name: string;
      description: string | null;
      sortOrder: number;
      isActive: boolean;
      items: Array<{
        id: string;
        key: string;
        categoryId: string;
        name: string;
        description: string | null;
        price: unknown;
        currency: string;
        photoUrl: string | null;
        sortOrder: number;
        isActive: boolean;
      }>;
    }>,
  ): CafeMenuResponseDto {
    return {
      cafeId,
      categories: rows.map((c) => ({
        id: c.id,
        key: c.key,
        name: c.name,
        description: c.description,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        items: c.items.map((i) => ({
          id: i.id,
          key: i.key,
          categoryId: i.categoryId,
          name: i.name,
          description: i.description,
          price: normalizePrice(i.price),
          currency: i.currency,
          photoUrl: i.photoUrl,
          sortOrder: i.sortOrder,
          isActive: i.isActive,
        })),
      })),
    };
  }

  async getPublicMenu(cafeId: string): Promise<CafeMenuResponseDto> {
    await this.assertCafeExists(cafeId);

    const categories = await this.prisma.cafeMenuCategory.findMany({
      where: { cafeId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        items: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    return this.mapMenu(cafeId, categories);
  }

  async getAdminMenu(params: {
    cafeId: string;
    keycloakId: string;
    includeInactive?: boolean;
  }): Promise<CafeMenuResponseDto> {
    const { cafeId, keycloakId, includeInactive } = params;
    await this.assertAdminAccessToCafe(cafeId, keycloakId);

    const categories = await this.prisma.cafeMenuCategory.findMany({
      where: { cafeId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        items: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
    });

    return this.mapMenu(cafeId, categories);
  }

  async exportMenu(params: {
    cafeId: string;
    keycloakId: string;
  }): Promise<CafeMenuJsonV1Dto> {
    const { cafeId, keycloakId } = params;
    await this.assertAdminAccessToCafe(cafeId, keycloakId);

    const categories = await this.prisma.cafeMenuCategory.findMany({
      where: { cafeId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    const items = await this.prisma.cafeMenuItem.findMany({
      where: { cafeId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { category: { select: { key: true } } },
    });

    await this.logMenuMutation(keycloakId, {
      action: ActivityAction.EXPORT_DATA,
      category: ActivityCategory.DATA,
      resourceType: 'MENU',
      resourceId: cafeId,
      details: {
        categories: categories.length,
        items: items.length,
      },
    });

    return {
      version: 1,
      cafeId,
      generatedAt: new Date().toISOString(),
      categories: categories.map((c) => ({
        key: c.key,
        name: c.name,
        description: c.description,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
      })),
      items: items.map((i) => ({
        key: i.key,
        categoryKey: i.category.key,
        name: i.name,
        description: i.description,
        price:
          typeof i.price === 'number'
            ? i.price
            : i.price && typeof i.price === 'object' && 'toNumber' in i.price
              ? (i.price as { toNumber(): number }).toNumber()
              : Number(i.price),
        currency: i.currency,
        photoUrl: i.photoUrl,
        sortOrder: i.sortOrder,
        isActive: i.isActive,
      })),
    };
  }

  async importMenu(params: {
    cafeId: string;
    keycloakId: string;
    mode?: string;
    menu: CafeMenuJsonV1Dto;
  }) {
    const { cafeId, keycloakId, menu } = params;
    const mode: MenuMode = params.mode === 'replace' ? 'replace' : 'merge';
    await this.assertAdminAccessToCafe(cafeId, keycloakId);

    const categoriesIn = (menu.categories ?? [])
      .map((c) => ({
        key: normalizeKey(c.key),
        name: String(c.name ?? '').trim(),
        description: c.description ?? null,
        sortOrder: typeof c.sortOrder === 'number' ? c.sortOrder : 0,
        isActive: typeof c.isActive === 'boolean' ? c.isActive : true,
      }))
      .filter((c) => c.key && c.name);

    const itemsIn = (menu.items ?? [])
      .map((i) => ({
        key: normalizeKey(i.key),
        categoryKey: normalizeKey(i.categoryKey),
        name: String(i.name ?? '').trim(),
        description: i.description ?? null,
        price: Number(i.price),
        currency: (i.currency ? String(i.currency) : 'BYN').trim() || 'BYN',
        photoUrl: i.photoUrl ?? null,
        sortOrder: typeof i.sortOrder === 'number' ? i.sortOrder : 0,
        isActive: typeof i.isActive === 'boolean' ? i.isActive : true,
      }))
      .filter((i) => i.key && i.categoryKey && i.name);

    if (itemsIn.some((i) => !Number.isFinite(i.price) || i.price < 0)) {
      throw new BadRequestException('Invalid item price in menu JSON');
    }

    const categoryKeys = new Set(categoriesIn.map((c) => c.key));
    const itemKeys = new Set(itemsIn.map((i) => i.key));

    await this.prisma.$transaction(async (tx) => {
      // Upsert categories
      for (const c of categoriesIn) {
        await tx.cafeMenuCategory.upsert({
          where: { cafeId_key: { cafeId, key: c.key } },
          create: {
            cafeId,
            key: c.key,
            name: c.name,
            description: c.description,
            sortOrder: c.sortOrder,
            isActive: c.isActive,
          },
          update: {
            name: c.name,
            description: c.description,
            sortOrder: c.sortOrder,
            isActive: c.isActive,
          },
        });
      }

      if (mode === 'replace') {
        await tx.cafeMenuCategory.updateMany({
          where: {
            cafeId,
            ...(categoryKeys.size
              ? { key: { notIn: Array.from(categoryKeys) } }
              : {}),
          },
          data: { isActive: false },
        });
      }

      const allCategories = await tx.cafeMenuCategory.findMany({
        where: { cafeId },
        select: { id: true, key: true },
      });
      const categoryKeyToId = new Map(allCategories.map((c) => [c.key, c.id]));

      // Upsert items
      for (const i of itemsIn) {
        const categoryId = categoryKeyToId.get(i.categoryKey);
        if (!categoryId)
          throw new BadRequestException(
            `Unknown categoryKey: ${i.categoryKey}`,
          );

        await tx.cafeMenuItem.upsert({
          where: { cafeId_key: { cafeId, key: i.key } },
          create: {
            cafeId,
            categoryId,
            key: i.key,
            name: i.name,
            description: i.description,
            price: i.price,
            currency: i.currency,
            photoUrl: i.photoUrl,
            sortOrder: i.sortOrder,
            isActive: i.isActive,
          },
          update: {
            categoryId,
            name: i.name,
            description: i.description,
            price: i.price,
            currency: i.currency,
            photoUrl: i.photoUrl,
            sortOrder: i.sortOrder,
            isActive: i.isActive,
          },
        });
      }

      if (mode === 'replace') {
        await tx.cafeMenuItem.updateMany({
          where: {
            cafeId,
            ...(itemKeys.size ? { key: { notIn: Array.from(itemKeys) } } : {}),
          },
          data: { isActive: false },
        });
      }
    });

    await this.logMenuMutation(keycloakId, {
      action: ActivityAction.BULK_UPDATE,
      category: ActivityCategory.DATA,
      resourceType: 'MENU',
      resourceId: cafeId,
      details: { mode, categories: categoriesIn.length, items: itemsIn.length },
    });

    return this.getAdminMenu({ cafeId, keycloakId, includeInactive: true });
  }

  async createCategory(params: {
    cafeId: string;
    keycloakId: string;
    dto: CreateMenuCategoryDto;
  }) {
    const { cafeId, keycloakId, dto } = params;
    await this.assertAdminAccessToCafe(cafeId, keycloakId);

    const key = normalizeKey(dto.key);
    if (!key) throw new BadRequestException('Category key is required');
    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Category name is required');

    const created = await this.prisma.cafeMenuCategory.create({
      data: {
        cafeId,
        key,
        name,
        description: dto.description ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.logMenuMutation(keycloakId, {
      action: ActivityAction.CREATE,
      category: ActivityCategory.DATA,
      resourceType: 'MENU_CATEGORY',
      resourceId: created.id,
      details: { cafeId, key },
    });
    return created;
  }

  async updateCategory(params: {
    cafeId: string;
    keycloakId: string;
    categoryId: string;
    dto: UpdateMenuCategoryDto;
  }) {
    const { cafeId, keycloakId, categoryId, dto } = params;
    await this.assertAdminAccessToCafe(cafeId, keycloakId);

    const existing = await this.prisma.cafeMenuCategory.findFirst({
      where: { id: categoryId, cafeId },
    });
    if (!existing) throw new NotFoundException('Menu category not found');

    const updated = await this.prisma.cafeMenuCategory.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.logMenuMutation(keycloakId, {
      action: ActivityAction.UPDATE,
      category: ActivityCategory.DATA,
      resourceType: 'MENU_CATEGORY',
      resourceId: categoryId,
      details: { cafeId },
    });
    return updated;
  }

  async deleteCategory(params: {
    cafeId: string;
    keycloakId: string;
    categoryId: string;
  }) {
    const { cafeId, keycloakId, categoryId } = params;
    await this.assertAdminAccessToCafe(cafeId, keycloakId);

    const existing = await this.prisma.cafeMenuCategory.findFirst({
      where: { id: categoryId, cafeId },
    });
    if (!existing) throw new NotFoundException('Menu category not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.cafeMenuCategory.update({
        where: { id: categoryId },
        data: { isActive: false },
      });
      await tx.cafeMenuItem.updateMany({
        where: { cafeId, categoryId },
        data: { isActive: false },
      });
    });

    await this.logMenuMutation(keycloakId, {
      action: ActivityAction.DELETE,
      category: ActivityCategory.DATA,
      resourceType: 'MENU_CATEGORY',
      resourceId: categoryId,
      details: { cafeId, soft: true },
    });

    return { ok: true };
  }

  async createItem(params: {
    cafeId: string;
    keycloakId: string;
    dto: CreateMenuItemDto;
  }) {
    const { cafeId, keycloakId, dto } = params;
    await this.assertAdminAccessToCafe(cafeId, keycloakId);

    const key = normalizeKey(dto.key);
    if (!key) throw new BadRequestException('Item key is required');
    const name = String(dto.name ?? '').trim();
    if (!name) throw new BadRequestException('Item name is required');

    const category = await this.prisma.cafeMenuCategory.findFirst({
      where: { id: dto.categoryId, cafeId },
    });
    if (!category) throw new NotFoundException('Menu category not found');

    const created = await this.prisma.cafeMenuItem.create({
      data: {
        cafeId,
        categoryId: dto.categoryId,
        key,
        name,
        description: dto.description ?? null,
        price: dto.price,
        currency: (dto.currency ?? 'BYN').trim() || 'BYN',
        photoUrl: dto.photoUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
    await this.logMenuMutation(keycloakId, {
      action: ActivityAction.CREATE,
      category: ActivityCategory.DATA,
      resourceType: 'MENU_ITEM',
      resourceId: created.id,
      details: { cafeId, key },
    });
    return created;
  }

  async updateItem(params: {
    cafeId: string;
    keycloakId: string;
    itemId: string;
    dto: UpdateMenuItemDto;
  }) {
    const { cafeId, keycloakId, itemId, dto } = params;
    await this.assertAdminAccessToCafe(cafeId, keycloakId);

    const existing = await this.prisma.cafeMenuItem.findFirst({
      where: { id: itemId, cafeId },
    });
    if (!existing) throw new NotFoundException('Menu item not found');

    if (dto.categoryId) {
      const category = await this.prisma.cafeMenuCategory.findFirst({
        where: { id: dto.categoryId, cafeId },
      });
      if (!category) throw new NotFoundException('Menu category not found');
    }

    const updated = await this.prisma.cafeMenuItem.update({
      where: { id: itemId },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.price !== undefined ? { price: dto.price } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.logMenuMutation(keycloakId, {
      action: ActivityAction.UPDATE,
      category: ActivityCategory.DATA,
      resourceType: 'MENU_ITEM',
      resourceId: itemId,
      details: { cafeId },
    });
    return updated;
  }

  async deleteItem(params: {
    cafeId: string;
    keycloakId: string;
    itemId: string;
  }) {
    const { cafeId, keycloakId, itemId } = params;
    await this.assertAdminAccessToCafe(cafeId, keycloakId);

    const existing = await this.prisma.cafeMenuItem.findFirst({
      where: { id: itemId, cafeId },
    });
    if (!existing) throw new NotFoundException('Menu item not found');

    await this.prisma.cafeMenuItem.update({
      where: { id: itemId },
      data: { isActive: false },
    });
    await this.logMenuMutation(keycloakId, {
      action: ActivityAction.DELETE,
      category: ActivityCategory.DATA,
      resourceType: 'MENU_ITEM',
      resourceId: itemId,
      details: { cafeId, soft: true },
    });
    return { ok: true };
  }
}
