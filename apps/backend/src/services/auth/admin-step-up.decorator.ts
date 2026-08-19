import { SetMetadata } from '@nestjs/common';
import { AdminVerificationPolicy } from '@gitroom/nestjs-libraries/database/prisma/admin-passkeys/admin-passkey.service';

export const ADMIN_STEP_UP_KEY = 'adminStepUp';

export const RequireAdminStepUp = (
  policy: AdminVerificationPolicy = 'general'
) => SetMetadata(ADMIN_STEP_UP_KEY, policy);
