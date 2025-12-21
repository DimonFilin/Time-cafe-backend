import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByKeycloakId(keycloakId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { keycloakId },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
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
}
