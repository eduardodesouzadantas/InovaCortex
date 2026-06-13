import { IdentityEventType } from '@prisma/client';

export type IIdentityEventType = IdentityEventType;

export interface TrackIdentityEventParams {
  type: IIdentityEventType;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, any>;
}
