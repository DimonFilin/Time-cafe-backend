import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard, Public } from 'nest-keycloak-connect';
import { MenuService } from './menu.service';
import { CafeMenuResponseDto } from './dto/cafe-menu-response.dto';
import { CafeMenuJsonV1Dto } from './dto/cafe-menu-json.dto';
import {
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  ImportCafeMenuDto,
  UpdateMenuCategoryDto,
  UpdateMenuItemDto,
} from './dto/menu-mutate.dto';

function requireKeycloakId(req: { user?: { sub?: string } }): string {
  const keycloakId = req.user?.sub;
  if (!keycloakId) throw new BadRequestException('User ID not found in token');
  return keycloakId;
}

@ApiTags('Cafe Menu')
@Controller('cafes/:cafeId/menu')
export class PublicCafeMenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get cafe menu (public)' })
  @ApiResponse({ status: 200, type: CafeMenuResponseDto })
  async getPublicMenu(
    @Param('cafeId') cafeId: string,
  ): Promise<CafeMenuResponseDto> {
    return this.menuService.getPublicMenu(cafeId);
  }
}

@ApiTags('Admin Cafe Menu')
@Controller('admin/cafes/:cafeId/menu')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class AdminCafeMenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  @ApiOperation({ summary: 'Get cafe menu for editing (admin)' })
  @ApiResponse({ status: 200, type: CafeMenuResponseDto })
  async getAdminMenu(
    @Param('cafeId') cafeId: string,
    @Request() req: { user?: { sub?: string } },
    @Query('includeInactive') includeInactive?: string,
  ): Promise<CafeMenuResponseDto> {
    return this.menuService.getAdminMenu({
      cafeId,
      keycloakId: requireKeycloakId(req),
      includeInactive: includeInactive === 'true' || includeInactive === '1',
    });
  }

  @Get('export')
  @ApiOperation({ summary: 'Export cafe menu as JSON (admin)' })
  @ApiResponse({ status: 200, type: CafeMenuJsonV1Dto })
  async exportMenu(
    @Param('cafeId') cafeId: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<CafeMenuJsonV1Dto> {
    return this.menuService.exportMenu({
      cafeId,
      keycloakId: requireKeycloakId(req),
    });
  }

  @Post('import')
  @ApiOperation({ summary: 'Import cafe menu from JSON (admin)' })
  @ApiResponse({ status: 200, type: CafeMenuResponseDto })
  async importMenu(
    @Param('cafeId') cafeId: string,
    @Body() body: ImportCafeMenuDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<CafeMenuResponseDto> {
    return this.menuService.importMenu({
      cafeId,
      keycloakId: requireKeycloakId(req),
      mode: body.mode,
      menu: body.menu,
    });
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create menu category (admin)' })
  async createCategory(
    @Param('cafeId') cafeId: string,
    @Body() dto: CreateMenuCategoryDto,
    @Request() req: { user?: { sub?: string } },
  ) {
    return this.menuService.createCategory({
      cafeId,
      keycloakId: requireKeycloakId(req),
      dto,
    });
  }

  @Patch('categories/:categoryId')
  @ApiOperation({ summary: 'Update menu category (admin)' })
  async updateCategory(
    @Param('cafeId') cafeId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateMenuCategoryDto,
    @Request() req: { user?: { sub?: string } },
  ) {
    return this.menuService.updateCategory({
      cafeId,
      keycloakId: requireKeycloakId(req),
      categoryId,
      dto,
    });
  }

  @Delete('categories/:categoryId')
  @ApiOperation({ summary: 'Deactivate menu category (admin)' })
  async deleteCategory(
    @Param('cafeId') cafeId: string,
    @Param('categoryId') categoryId: string,
    @Request() req: { user?: { sub?: string } },
  ) {
    return this.menuService.deleteCategory({
      cafeId,
      keycloakId: requireKeycloakId(req),
      categoryId,
    });
  }

  @Post('items')
  @ApiOperation({ summary: 'Create menu item (admin)' })
  async createItem(
    @Param('cafeId') cafeId: string,
    @Body() dto: CreateMenuItemDto,
    @Request() req: { user?: { sub?: string } },
  ) {
    return this.menuService.createItem({
      cafeId,
      keycloakId: requireKeycloakId(req),
      dto,
    });
  }

  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Update menu item (admin)' })
  async updateItem(
    @Param('cafeId') cafeId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateMenuItemDto,
    @Request() req: { user?: { sub?: string } },
  ) {
    return this.menuService.updateItem({
      cafeId,
      keycloakId: requireKeycloakId(req),
      itemId,
      dto,
    });
  }

  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Deactivate menu item (admin)' })
  async deleteItem(
    @Param('cafeId') cafeId: string,
    @Param('itemId') itemId: string,
    @Request() req: { user?: { sub?: string } },
  ) {
    return this.menuService.deleteItem({
      cafeId,
      keycloakId: requireKeycloakId(req),
      itemId,
    });
  }
}
