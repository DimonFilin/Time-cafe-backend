import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { CancelAppointmentDto } from './dto/cancel-appointment.dto';
import { AppointmentResponseDto } from './dto/appointment-response.dto';
import { AppointmentListResponseDto } from './dto/appointment-list-response.dto';
import { AppointmentListQueryDto } from './dto/appointment-list-query.dto';
import { AuthGuard } from 'nest-keycloak-connect';

@ApiTags('Appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create appointment' })
  @ApiResponse({
    status: 201,
    description: 'Appointment created successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Cafe not found' })
  @ApiResponse({ status: 409, description: 'Time slot not available' })
  async create(
    @Body() createAppointmentDto: CreateAppointmentDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AppointmentResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.appointmentsService.create(keycloakId, createAppointmentDto);
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user appointments',
    description:
      'Returns list of user appointments with pagination and filters',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointments retrieved successfully',
    type: AppointmentListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findUserAppointments(
    @Query() query: AppointmentListQueryDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AppointmentListResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.appointmentsService.findUserAppointments(keycloakId, query);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get appointment by ID' })
  @ApiResponse({
    status: 200,
    description: 'Appointment details',
    type: AppointmentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async findOne(
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AppointmentResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.appointmentsService.findOne(id, keycloakId);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update appointment',
    description: 'Update appointment details (only for pending appointments)',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment updated successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  @ApiResponse({ status: 409, description: 'Time slot not available' })
  async update(
    @Param('id') id: string,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AppointmentResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.appointmentsService.update(
      id,
      keycloakId,
      updateAppointmentDto,
    );
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel appointment' })
  @ApiResponse({
    status: 200,
    description: 'Appointment cancelled successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async cancel(
    @Param('id') id: string,
    @Body() cancelDto: CancelAppointmentDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AppointmentResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.appointmentsService.cancel(id, keycloakId, cancelDto);
  }

  @Get('cafe/:cafeId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get cafe appointments (CAFE_ADMIN/WORKER only)',
    description:
      'Returns appointments for a specific cafe (requires cafe worker permissions)',
  })
  @ApiResponse({
    status: 200,
    description: 'Cafe appointments retrieved successfully',
    type: AppointmentListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - cafe worker permissions required',
  })
  async findCafeAppointments(
    @Param('cafeId') cafeId: string,
    @Query() query: AppointmentListQueryDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AppointmentListResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.appointmentsService.findCafeAppointments(
      cafeId,
      keycloakId,
      query,
    );
  }

  @Get('cafe/:cafeId/:appointmentId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get cafe appointment by ID (CAFE_ADMIN/WORKER only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment details',
    type: AppointmentResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - cafe worker permissions required',
  })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async findCafeAppointment(
    @Param('appointmentId') appointmentId: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AppointmentResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.appointmentsService.findCafeAppointment(
      appointmentId,
      keycloakId,
    );
  }

  @Post('cafe/:appointmentId/confirm')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm appointment (CAFE_ADMIN/WORKER only)',
    description:
      'Confirm a pending appointment (requires cafe worker permissions)',
  })
  @ApiResponse({
    status: 200,
    description: 'Appointment confirmed successfully',
    type: AppointmentResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request - invalid status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - cafe worker permissions required',
  })
  @ApiResponse({ status: 404, description: 'Appointment not found' })
  async confirmAppointment(
    @Param('appointmentId') appointmentId: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<AppointmentResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }

    return this.appointmentsService.confirmAppointment(
      appointmentId,
      keycloakId,
    );
  }
}
