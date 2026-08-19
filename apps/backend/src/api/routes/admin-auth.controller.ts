import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { GetOriginalOperatorFromRequest } from '@gitroom/nestjs-libraries/user/original.operator.from.request';
import {
  AdminOperator,
  AdminPasskeyService,
  AdminVerificationIssue,
} from '@gitroom/nestjs-libraries/database/prisma/admin-passkeys/admin-passkey.service';
import {
  AdminPasskeyAssertionDto,
  AdminPasskeyRegistrationDto,
} from '@gitroom/nestjs-libraries/dtos/admin/admin-passkey.dto';
import {
  readAdminAuthToken,
  setAdminAuthCookie,
} from '@gitroom/backend/services/auth/admin-auth.cookie';

@ApiTags('Admin Auth')
@Controller('/admin-auth')
export class AdminAuthController {
  constructor(private _adminPasskeyService: AdminPasskeyService) { }

  @Get('/status')
  status(
    @GetOriginalOperatorFromRequest() operator: AdminOperator,
    @Req() request: Request
  ) {
    return this._adminPasskeyService.getStatus(
      operator,
      readAdminAuthToken(request)
    );
  }

  @Post('/register-options')
  registerOptions(@GetOriginalOperatorFromRequest() operator: AdminOperator) {
    return this._adminPasskeyService.createRegistrationOptions(operator);
  }

  @Post('/register-verify')
  async registerVerify(
    @GetOriginalOperatorFromRequest() operator: AdminOperator,
    @Body() body: AdminPasskeyRegistrationDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const issued = await this._adminPasskeyService.verifyRegistration(
      operator,
      body as unknown as RegistrationResponseJSON
    );

    return this.issueSession(response, issued);
  }

  @Post('/challenge')
  challenge(@GetOriginalOperatorFromRequest() operator: AdminOperator) {
    return this._adminPasskeyService.createAssertionOptions(operator);
  }

  @Post('/verify')
  async verify(
    @GetOriginalOperatorFromRequest() operator: AdminOperator,
    @Body() body: AdminPasskeyAssertionDto,
    @Res({ passthrough: true }) response: Response
  ) {
    const issued = await this._adminPasskeyService.verifyAssertion(
      operator,
      body as unknown as AuthenticationResponseJSON
    );

    return this.issueSession(response, issued);
  }

  private issueSession(response: Response, issued: AdminVerificationIssue) {
    setAdminAuthCookie(response, issued.token, issued.expiresAt);

    return {
      enrolled: true,
      verified: true,
      fresh: true,
      expiresAt: issued.expiresAt.toISOString(),
      freshUntil: issued.freshUntil.toISOString(),
    };
  }
}
