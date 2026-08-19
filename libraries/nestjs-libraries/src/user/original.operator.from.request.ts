import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * The normal-login principal loaded from the database before impersonation can
 * replace `request.user`. Never falls back to `request.user`, so an
 * impersonated principal can never stand in for the original operator.
 */
export const ORIGINAL_OPERATOR_REQUEST_KEY = 'originalOperator';

export const GetOriginalOperatorFromRequest = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request[ORIGINAL_OPERATOR_REQUEST_KEY];
  }
);
