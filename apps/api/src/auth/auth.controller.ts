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
import type { Request, Response } from 'express';
import type { ForgotPasswordResponse, LoginResponse, SessionUser } from '@normatiza/shared';

import { AuthService } from './auth.service';
import { ForgotPasswordDto, LoginDto, ResetPasswordDto } from './dto/auth.dto';
import { AuthenticatedRequest, JwtAuthGuard } from './jwt-auth.guard';
import { REFRESH_COOKIE, REFRESH_HEADER } from './session-transport';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() _dto: LoginDto,
    @Req() _req: Request,
    @Res({ passthrough: true }) _res: Response,
  ): Promise<LoginResponse> {
    throw new Error('AuthController.login não implementado');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Req() _req: Request,
    @Res({ passthrough: true }) _res: Response,
  ): Promise<LoginResponse> {
    throw new Error('AuthController.refresh não implementado');
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Req() _req: Request, @Res({ passthrough: true }) _res: Response): Promise<void> {
    throw new Error('AuthController.logout não implementado');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() _req: AuthenticatedRequest): Promise<SessionUser> {
    throw new Error('AuthController.me não implementado');
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  forgotPassword(@Body() _dto: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    throw new Error('AuthController.forgotPassword não implementado');
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Body() _dto: ResetPasswordDto): Promise<void> {
    throw new Error('AuthController.resetPassword não implementado');
  }
}

/** Lê o refresh token do transporte que a requisição usou — cookie ou cabeçalho. */
export function extractRefreshToken(req: Request): string {
  const doCookie = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
  const doCabeçalho = req.headers[REFRESH_HEADER];

  const token = doCookie ?? (Array.isArray(doCabeçalho) ? doCabeçalho[0] : doCabeçalho);

  if (!token) throw new UnauthorizedException();

  return token;
}
