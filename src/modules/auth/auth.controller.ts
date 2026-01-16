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
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
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
  async loginSelect(@Body() dto: LoginSelectDto): Promise<AuthResponseDto> {
    return this.authService.loginSelect(dto);
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
    @Request() req: { user?: { sub?: string } },
  ): Promise<MeResponseDto> {
    const keycloakId = req.user?.sub;
    if (!keycloakId) {
      throw new UnauthorizedException('User not authenticated');
    }
    return this.authService.getMe(keycloakId);
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
