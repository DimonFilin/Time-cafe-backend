import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User, Prisma } from '@prisma/client';
import { AdminUserListQueryDto } from './dto/admin-user-list-query.dto';
import { AdminUserListResponseDto } from './dto/admin-user-list-response.dto';
import { AdminUserListItemDto } from './dto/admin-user-list-item.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByKeycloakId(keycloakId: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        keycloakId,
        deletedAt: null,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: {
    keycloakId: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async getOrCreateByKeycloakId(
    keycloakId: string,
    email: string,
  ): Promise<User> {
    const existing = await this.findByKeycloakId(keycloakId);
    if (existing) {
      if (existing.email !== email) {
        return this.updateEmail(existing.id, email);
      }
      return existing;
    }

    return this.create({
      keycloakId,
      email,
      firstName: '',
      lastName: '',
    });
  }

  async updateEmail(userId: string, email: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { email },
    });
  }

  async update(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatar?: string;
    },
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async softDelete(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Get all users for SYSTEM_ADMIN
   */
  async findAllAdmin(
    query: AdminUserListQueryDto,
  ): Promise<AdminUserListResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (!query.includeDeleted) {
      where.deletedAt = null;
    }

    if (query.email) {
      where.email = {
        contains: query.email,
        mode: 'insensitive',
      };
    }

    if (query.firstName) {
      where.firstName = {
        contains: query.firstName,
        mode: 'insensitive',
      };
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map((u) => this.mapToAdminListItem(u)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get user by ID for SYSTEM_ADMIN
   */
  async findOneAdmin(userId: string): Promise<AdminUserListItemDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapToAdminListItem(user);
  }

  /**
   * Update user for SYSTEM_ADMIN
   */
  async updateAdmin(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatar?: string;
      balanceDelta?: number;
    },
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;

    if (data.balanceDelta !== undefined) {
      const currentBalance = Number(user.balance);
      const newBalance = currentBalance + data.balanceDelta;
      updateData.balance = newBalance;
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  /**
   * Delete user (soft delete) for SYSTEM_ADMIN
   */
  async deleteAdmin(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Map User to AdminUserListItemDto
   */
  private mapToAdminListItem(user: User): AdminUserListItemDto {
    return {
      id: user.id,
      keycloakId: user.keycloakId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatar: user.avatar,
      balance: Number(user.balance),
      deletedAt: user.deletedAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
