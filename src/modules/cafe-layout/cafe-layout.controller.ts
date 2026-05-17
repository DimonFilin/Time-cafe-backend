import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'nest-keycloak-connect';
import { CafeLayoutService, type EditorPayload } from './cafe-layout.service';

@ApiTags('Cafe Layout')
@Controller('cafe-layout')
export class CafeLayoutController {
  constructor(private readonly cafeLayoutService: CafeLayoutService) {}

  @Get('cafes/:cafeId/editor')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get full editable cafe layout state' })
  async getEditorState(
    @Param('cafeId') cafeId: string,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.cafeLayoutService.getEditorState(cafeId, req.user?.sub || '');
  }

  @Put('cafes/:cafeId/editor')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save cafe layout rooms/elements/assets' })
  async saveEditorState(
    @Param('cafeId') cafeId: string,
    @Body() body: EditorPayload,
    @Req() req: { user?: { sub?: string } },
  ) {
    return this.cafeLayoutService.saveEditorState(
      cafeId,
      req.user?.sub || '',
      body,
    );
  }

  @Get('cafes/:cafeId/occupancy')
  @ApiOperation({
    summary:
      'Occupancy: single date (?date=) or range (?from=&to=, max 31 days, avg of daily %)',
  })
  async getOccupancy(
    @Param('cafeId') cafeId: string,
    @Query('date') date?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.cafeLayoutService.getOccupancy(cafeId, { date, from, to });
  }

  @Get('cafes/:cafeId/rooms/availability')
  @ApiOperation({ summary: 'Get room availability by date' })
  async getRoomAvailability(
    @Param('cafeId') cafeId: string,
    @Query('date') date: string,
  ) {
    return this.cafeLayoutService.getRoomAvailability(cafeId, date);
  }
}
