import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { ForgotPasswordResponse, LoginResponse, SessionUser } from '@normatiza/shared';

import { AuthResult, AuthService } from './auth.service';
import { ForgotPasswordDto, LoginDto, ResetPasswordDto } from './dto/auth.dto';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import {
  REFRESH_COOKIE,
  REFRESH_HEADER,
  refreshCookieOptions,
  usaTransporteNativo,
} from './session-transport';
import { RateLimitCredencial, RateLimitRefresh } from './rate-limit';
import { duraçãoEmMs } from './token.service';
import { EnvironmentVariables } from '../config/env.validation';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimitCredencial()
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    return this.entregaSessão(await this.auth.login(dto, contextoDe(req)), req, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimitRefresh()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const atual = extractRefreshToken(req);

    return this.entregaSessão(await this.auth.refresh(atual, contextoDe(req)), req, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(extractRefreshToken(req), contextoDe(req));
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest): Promise<SessionUser> {
    return this.auth.buildSession(req.auth!.userId);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @RateLimitCredencial()
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    return this.auth.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RateLimitCredencial()
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  /**
   * O refresh token sai por **um** transporte, nunca pelos dois: no cookie para
   * o web, no corpo para o app. Devolvê-lo no corpo *e* no cookie colocaria numa
   * string legível pelo JavaScript exatamente o que o cookie existe para
   * esconder.
   */
  private entregaSessão(resultado: AuthResult, req: Request, res: Response): LoginResponse {
    const { refreshToken, ...resposta } = resultado;

    if (usaTransporteNativo(req.headers)) {
      return resultado;
    }

    res.cookie(
      REFRESH_COOKIE,
      refreshToken,
      refreshCookieOptions(
        this.config.get('COOKIE_CROSS_SITE', { infer: true }) === 'true',
        duraçãoEmMs(this.config.get('JWT_REFRESH_TTL', { infer: true })),
      ),
    );

    return resposta;
  }
}

function contextoDe(req: Request) {
  return { userAgent: req.headers['user-agent'], ipAddress: req.ip };
}

/** Lê o refresh token do transporte que a requisição usou — cookie ou cabeçalho. */
export function extractRefreshToken(req: Request): string {
  const doCookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  const doCabeçalho = req.headers[REFRESH_HEADER];

  const token = doCookie ?? (Array.isArray(doCabeçalho) ? doCabeçalho[0] : doCabeçalho);

  if (!token) throw new UnauthorizedException();

  return token;
}
