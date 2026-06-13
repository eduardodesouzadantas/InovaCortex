import { createIdentityEvent } from '@/app/repositories/identityEvents/identityEvent.repository';
import { TrackIdentityEventParams } from '@/app/domain/identityEvents/types';

export async function trackEvent(params: TrackIdentityEventParams) {
  try {
    return await createIdentityEvent(params);
  } catch (err) {
    // Top level catch just in case
    console.error('[IdentityEventService] trackEvent exception:', err);
    return null;
  }
}
