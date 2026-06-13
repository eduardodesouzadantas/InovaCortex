import { prisma } from '@/lib/prisma';
import { TrackIdentityEventParams } from '@/app/domain/identityEvents/types';

export async function createIdentityEvent(data: TrackIdentityEventParams) {
  try {
    if (!prisma.identityEvent) {
      return null;
    }
    return await prisma.identityEvent.create({
      data: {
        type: data.type,
        userId: data.userId,
        organizationId: data.organizationId,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
      },
    });
  } catch (error) {
    console.error(`[IdentityEventRepository] Failed to store event ${data.type}:`, error);
    // Silent fail to not break main flows
    return null;
  }
}
