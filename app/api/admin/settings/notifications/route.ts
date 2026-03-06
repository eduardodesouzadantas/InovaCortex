import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { prisma } from "@/lib/prisma";

// GET — fetch current notification channel config
export async function GET() {
    const session = await getSession();
    if (!session || !can(session.role, "manageSettings")) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const channel = await (prisma as any).orgNotificationChannel.findUnique({
        where: { organizationId: session.orgId }
    });

    return NextResponse.json({ channel: channel ?? null });
}

// POST — upsert notification channel config
export async function POST(req: Request) {
    const session = await getSession();
    if (!session || !can(session.role, "manageSettings")) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { ownerWhatsApp, ownerEmail, preferChannel } = body;

    const updated = await (prisma as any).orgNotificationChannel.upsert({
        where: { organizationId: session.orgId },
        create: {
            organizationId: session.orgId,
            ownerWhatsApp: ownerWhatsApp ?? null,
            ownerEmail: ownerEmail ?? null,
            preferChannel: preferChannel ?? "whatsapp"
        },
        update: {
            ownerWhatsApp: ownerWhatsApp ?? null,
            ownerEmail: ownerEmail ?? null,
            preferChannel: preferChannel ?? "whatsapp"
        }
    });

    await (prisma as any).auditEvent.create({
        data: {
            organizationId: session.orgId,
            action: "notificationChannelUpdated",
            userId: session.userId,
            resourceType: "org_notification_channel",
            resourceId: updated.id,
            details: `preferChannel=${updated.preferChannel}`,
            ipAddress: "system"
        }
    });

    return NextResponse.json({ success: true, channel: updated });
}
