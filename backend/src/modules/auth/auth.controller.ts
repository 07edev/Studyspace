import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { ApiException } from '../../common/api-error';
import { CurrentUser, Public } from '../../common/decorators/auth.decorators';
import type { IdentityContext } from '../../common/identity';
import type { RequestWithId } from '../../common/middleware/request-id.middleware';
import { Inject } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/configuration';
import { AuthService, type SessionResult } from './auth.service';
import {
  AccountDeleteRequest,
  AuthLogin,
  AuthRegister,
  ChangePassword,
  ContactChangeConfirm,
  ContactChangeRequest,
  GoogleLogin,
  OtpRequest,
  OtpVerify,
  ResetPassword,
  TokenRefresh,
} from './dto/auth.dto';

const COOKIE = 'ss_refresh';
const COOKIE_PATH = '/api/v1/auth';
const perMinute = (limit: number) => Throttle({ default: { limit, ttl: 60_000 } });

const readCookie = (req: Request, name: string) =>
  (req.headers.cookie ?? '')
    .split(';')
    .map(part => part.trim().split('='))
    .find(([key]) => key === name)?.[1];

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(COOKIE, token, {
      httpOnly: true,
      secure: this.config.nodeEnv === 'production',
      sameSite: 'strict',
      path: COOKIE_PATH,
      maxAge: this.config.refreshTtlDays * 24 * 60 * 60 * 1000,
    });
  }

  private finishLogin(result: SessionResult, res: Response) {
    if (result.client === 'WEB_ADMIN') {
      this.setRefreshCookie(res, result.refreshToken);
    }
    return result.body;
  }

  @Public() @perMinute(10) @Post('register')
  register(@Body() dto: AuthRegister) {
    return this.auth.register(dto);
  }

  @Public() @perMinute(10) @HttpCode(200) @Post('email/verify')
  async verifyEmail(@Body() dto: OtpVerify, @Res({ passthrough: true }) res: Response) {
    return this.finishLogin(await this.auth.verifyEmail(dto.email, dto.otp), res);
  }

  @Public() @perMinute(5) @HttpCode(202) @Post('email/resend-otp')
  resendOtp(@Body() dto: OtpRequest) {
    return this.auth.resendVerification(dto.email);
  }

  @Public() @perMinute(10) @HttpCode(200) @Post('login')
  async login(@Body() dto: AuthLogin, @Res({ passthrough: true }) res: Response) {
    return this.finishLogin(await this.auth.login(dto), res);
  }

  @Public() @perMinute(10) @HttpCode(200) @Post('google')
  async google(@Body() dto: GoogleLogin, @Res({ passthrough: true }) res: Response) {
    return this.finishLogin(await this.auth.loginWithGoogle(dto), res);
  }

  @Public() @perMinute(30) @HttpCode(200) @Post('token/refresh')
  async refresh(
    @Body() dto: TokenRefresh,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    let token = dto.refreshToken;
    if (dto.client === 'WEB_ADMIN') {
      // Cookie auth is CSRF-prone: require a non-simple header (forces a CORS preflight)
      // in addition to SameSite=Strict.
      if (req.header('x-requested-with') !== 'XMLHttpRequest') {
        throw new ApiException(403, 'FORBIDDEN', 'Yêu cầu không hợp lệ.');
      }
      token = readCookie(req, COOKIE);
    }
    if (!token) {
      throw new ApiException(401, 'TOKEN_INVALID', 'Phiên đăng nhập không hợp lệ.');
    }
    const result = await this.auth.refresh(token, dto.client);
    if (dto.client === 'WEB_ADMIN') {
      this.setRefreshCookie(res, result.refreshToken);
    }
    return result.tokens;
  }

  @ApiBearerAuth() @HttpCode(204) @Post('logout')
  async logout(@CurrentUser() user: IdentityContext, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(user);
    res.clearCookie(COOKIE, { path: COOKIE_PATH });
  }

  @ApiBearerAuth() @Get('me')
  me(@CurrentUser() user: IdentityContext) {
    return this.auth.me(user);
  }

  @Public() @perMinute(5) @HttpCode(202) @Post('password/forgot')
  forgot(@Body() dto: OtpRequest) {
    return this.auth.forgotPassword(dto.email);
  }

  @Public() @perMinute(10) @HttpCode(200) @Post('password/verify-otp')
  verifyResetOtp(@Body() dto: OtpVerify) {
    return this.auth.verifyResetOtp(dto.email, dto.otp);
  }

  @Public() @perMinute(10) @HttpCode(200) @Post('password/reset')
  reset(@Body() dto: ResetPassword, @Req() req: RequestWithId) {
    return this.auth.resetPassword(dto, req.requestId);
  }

  @ApiBearerAuth() @perMinute(10) @HttpCode(200) @Post('password/change')
  change(@CurrentUser() user: IdentityContext, @Body() dto: ChangePassword, @Req() req: RequestWithId) {
    return this.auth.changePassword(user, dto, req.requestId);
  }

  @ApiBearerAuth() @perMinute(5) @HttpCode(202) @Post('contact/change-request')
  contactChangeRequest(@CurrentUser() user: IdentityContext, @Body() dto: ContactChangeRequest) {
    return this.auth.requestContactChange(user, dto);
  }

  @ApiBearerAuth() @perMinute(10) @HttpCode(200) @Post('contact/change-confirm')
  contactChangeConfirm(@CurrentUser() user: IdentityContext, @Body() dto: ContactChangeConfirm) {
    return this.auth.confirmContactChange(user, dto);
  }

  @ApiBearerAuth() @perMinute(5) @HttpCode(202) @Post('account/deletion-requests')
  deletion(@CurrentUser() user: IdentityContext, @Body() dto: AccountDeleteRequest, @Req() req: RequestWithId) {
    return this.auth.requestDeletion(user, dto, req.requestId);
  }
}
