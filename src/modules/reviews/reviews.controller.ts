import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewResponseDto } from './dto/review-response.dto';
import { ReviewListQueryDto } from './dto/review-list-query.dto';
import { ReviewListResponseDto } from './dto/review-list-response.dto';
import { AuthGuard, Public } from 'nest-keycloak-connect';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create review for cafe' })
  @ApiResponse({
    status: 201,
    description: 'Review created successfully',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Cafe or order not found' })
  create(
    @Body() createReviewDto: CreateReviewDto,
    @Request() req: { user?: { sub?: string } },
  ): Promise<ReviewResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }
    return this.reviewsService.create(keycloakId, createReviewDto);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get list of reviews' })
  @ApiResponse({
    status: 200,
    description: 'List of reviews',
    type: ReviewListResponseDto,
  })
  findAll(@Query() query: ReviewListQueryDto): Promise<ReviewListResponseDto> {
    return this.reviewsService.findAll(query);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get review by ID' })
  @ApiResponse({
    status: 200,
    description: 'Review details',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Review not found' })
  findOne(@Param('id') id: string): Promise<ReviewResponseDto> {
    return this.reviewsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update review (only by owner)' })
  @ApiResponse({
    status: 200,
    description: 'Review updated successfully',
    type: ReviewResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateReviewDto>,
    @Request() req: { user?: { sub?: string } },
  ): Promise<ReviewResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }
    return this.reviewsService.update(id, keycloakId, updateDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete review (soft delete, only by owner)' })
  @ApiResponse({ status: 200, description: 'Review deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  remove(
    @Param('id') id: string,
    @Request() req: { user?: { sub?: string } },
  ): Promise<void> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new BadRequestException('User ID not found in token');
    }
    return this.reviewsService.remove(id, keycloakId);
  }
}
