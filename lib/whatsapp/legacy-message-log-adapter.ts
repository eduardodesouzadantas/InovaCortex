import { prisma } from "@/lib/prisma";

import type { WhatsAppMessageLifecycleEvent } from "./pipeline-contract";

function safeJson(value: unknown): string {
    try {
        return JSON.stringify(value ?? {});
    } catch {
        return "{}";
    }
}

/**
 * Temporary compatibility bridge for legacy assessment/lead flows that still
 * persist status into `MessageLog`. New canonical WhatsApp flows must use
 * `WhatsAppMessage` + status ledger instead.
 */
export async function reconcileLegacyMessageLog(
    externalMessageId: string,
    lifecycleEvent: WhatsAppMessageLifecycleEvent,
): Promise<boolean> {
    const legacyLog = await prisma.messageLog.findFirst({
        where: {
            provider: "whatsapp_meta",
            payloadRedacted: { contains: externalMessageId },
        },
        select: {
            id: true,
        },
    });

    if (!legacyLog) {
        return false;
    }

    await prisma.messageLog.update({
        where: { id: legacyLog.id },
        data: {
            status: lifecycleEvent.lifecycleStatus ?? lifecycleEvent.providerStatus,
            payloadRedacted: safeJson({
                externalMessageId,
                providerStatus: lifecycleEvent.providerStatus,
                lifecycleStatus: lifecycleEvent.lifecycleStatus,
                failureClass: lifecycleEvent.failureClass,
            }),
        },
    });

    return true;
}
