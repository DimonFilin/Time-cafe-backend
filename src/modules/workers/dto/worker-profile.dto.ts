import { ApiProperty } from '@nestjs/swagger';
import { WorkerRole } from '@prisma/client';

export class WorkerProfileDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ enum: WorkerRole })
  role: WorkerRole;

  @ApiProperty({ required: false })
  brandId?: string;

  @ApiProperty({ required: false })
  cafeId?: string;

  @ApiProperty()
  createdAt: Date;
}
