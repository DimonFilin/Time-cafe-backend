import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  Request,
  Response,
  UnauthorizedException,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { Response as ExpressResponse } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Public } from 'nest-keycloak-connect';
import { AuthService } from './services/auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { LoginLookupDto } from './dto/login-lookup.dto';
import { LoginSelectDto } from './dto/login-select.dto';
import { LoginLookupResponseDto } from './dto/login-lookup-response.dto';
import { MeResponseDto } from './dto/me-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Creates a new user account in Keycloak and database',
  })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists',
  })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user',
    description: 'Authenticates user and returns access and refresh tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'User successfully authenticated',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Refreshes the access token using a valid refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token successfully refreshed',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired refresh token',
  })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Post('login/lookup')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Lookup accounts for email and password',
    description:
      'Validates credentials and returns list of available accounts (User and WorkerAccount)',
  })
  @ApiResponse({
    status: 200,
    description: 'Accounts found successfully',
    type: LoginLookupResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  async loginLookup(
    @Body() dto: LoginLookupDto,
  ): Promise<LoginLookupResponseDto> {
    return this.authService.loginLookup(dto);
  }

  @Post('login/select')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Select account and get tokens',
    description:
      'Selects an account from lookup results and returns access/refresh tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'Account selected successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid account ID or lookup token',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired lookup token',
  })
  async loginSelect(
    @Body() dto: LoginSelectDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.loginSelect(dto);

    // Store selected accountId in httpOnly cookie
    // Cookie expires when access token expires
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('tc_account_id', dto.accountId, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: result.expiresIn * 1000, // Convert seconds to milliseconds
    });

    return result;
  }

  @Get('me')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get current user profile',
    description:
      'Returns the profile of the currently authenticated user with role information',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
    type: MeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async getProfile(
    @Request()
    req: {
      user?: { sub?: string };
      cookies?: { tc_account_id?: string };
      headers?: { cookie?: string };
    },
  ): Promise<MeResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Get selected accountId from cookie (if exists)
    const selectedAccountId =
      req.cookies?.tc_account_id ??
      req.headers?.cookie
        ?.split(';')
        .map((p) => p.trim())
        .find((p) => p.startsWith('tc_account_id='))
        ?.split('=')[1];

    return this.authService.getMe(keycloakId, selectedAccountId);
  }

  @Patch('me')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Updates the profile of the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
    type: UserProfileDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async updateProfile(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: UpdateUserDto,
  ): Promise<UserProfileDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.authService.updateProfile(keycloakId, dto);
  }

  @Post('me/avatar')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload avatar for current user',
    description:
      'Uploads avatar image to storage and updates current user profile',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User profile updated successfully',
    type: UserProfileDto,
  })
  async uploadMyAvatar(
    @Request() req: { user?: { sub?: string } },
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          mimetype: string;
          size: number;
          originalname?: string;
        }
      | undefined,
  ): Promise<UserProfileDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) throw new UnauthorizedException('User not authenticated');
    if (!file) throw new BadRequestException('File is required');
    return this.authService.uploadMyAvatar(keycloakId, file);
  }

  @Get('me/avatar-url')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get signed URL for current user avatar',
    description: 'Returns signed URL to display avatar from storage',
  })
  async getMyAvatarUrl(
    @Request()
    req: {
      user?: { sub?: string };
      headers?: { host?: string; 'x-forwarded-proto'?: string };
    },
  ): Promise<{ url: string | null }> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) throw new UnauthorizedException('User not authenticated');

    const host = req.headers?.host;
    const proto = req.headers?.['x-forwarded-proto'];

    const res = await this.authService.getMyAvatarSignedUrl({
      keycloakId,
      requestHost: host,
      requestProto: proto,
    });
    return res as { url: string | null };
  }

  @Get('me/avatar-file')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Stream current user avatar (mobile-friendly, no MinIO :9000)',
    description:
      'Returns avatar image bytes via API so clients on networks without direct storage access can load profile photos',
  })
  async streamMyAvatarFile(
    @Request() req: { user?: { sub?: string } },
    @Response({ passthrough: false }) res: ExpressResponse,
  ) {
    const keycloakId = req.user?.sub;
    if (!keycloakId) throw new UnauthorizedException('User not authenticated');

    const { data, contentType } =
      await this.authService.streamMyAvatarFile(keycloakId);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(data);
  }

  @Post('change-password')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change user password',
    description: 'Changes the password for the currently authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized or current password is incorrect',
  })
  async changePassword(
    @Request() req: { user?: { sub?: string } },
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }
    await this.authService.changePassword(
      keycloakId,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'Password changed successfully' };
  }

  @Delete('me')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete current user account',
    description:
      'Soft deletes the user account (deletes from Keycloak, marks as deleted in database)',
  })
  @ApiResponse({
    status: 200,
    description: 'User account deleted successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async deleteAccount(
    @Request() req: { user?: { sub?: string } },
  ): Promise<{ message: string }> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }
    await this.authService.deleteAccount(keycloakId);
    return { message: 'User account deleted successfully' };
  }
}
