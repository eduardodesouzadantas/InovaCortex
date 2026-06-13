import { prisma } from "@/lib/prisma";

/**
 * lib/whatsapp/rbac.ts — WhatsApp RBAC (V34)
 *
 * Role hierarchy:
 *   ceo   → full access: all commands + executive data (revenue, leaks, pipeline)
 *   admin → full access: all commands + executive data
 *   sales → restricted: own leads only, no executive data
 */

export type WhatsAppRole = "ceo" | "admin" | "sales";

// Commands blocked for sales role
const EXECUTIVE_COMMANDS = new Set([
    "/revenue", "/leaks", "/growth", "/pipeline",
    "/playbook", "/objections", "/test-strategy",
    "/team", "/sla", "/assign"
]);

// Commands available to all roles
const PUBLIC_COMMANDS = new Set([
    "/today", "/help", "/client", "/rep"
]);

export interface WhatsAppActor {
    waUserId: string;
    phone: string;
    orgId: string;
    orgSlug: string;
    userId: string | null;
    role: WhatsAppRole;
    name: string | null;
    active: boolean;
}

/**
 * Resolve actor from phone number using the WhatsAppUser table.
 * Returns null if not found or inactive.
 */
export async function resolveActor(phone: string): Promise<WhatsAppActor | null> {
    const waUser = await prisma.whatsAppUser.findFirst({
        where: { phoneNumber: phone, active: true },
        include: {
            organization: { select: { id: true, slug: true } }
        }
    });

    if (!waUser) return null;

    return {
        waUserId: waUser.id,
        phone: waUser.phoneNumber,
        orgId: waUser.organization.id,
        orgSlug: waUser.organization.slug,
        userId: waUser.userId || null,
        role: waUser.role as WhatsAppRole,
        name: waUser.name || null,
        active: waUser.active
    };
}

/**
 * Check if an actor can execute a given command.
 */
export function canExecuteCommand(role: WhatsAppRole, command: string): boolean {
    if (role === "ceo" || role === "admin") return true;
    if (EXECUTIVE_COMMANDS.has(command)) return false;
    // sales: only public commands
    if (PUBLIC_COMMANDS.has(command)) return true;
    return false;
}

/**
 * Check if an actor can see executive data.
 */
export function hasExecutiveAccess(role: WhatsAppRole): boolean {
    return role === "ceo" || role === "admin";
}

/**
 * Get denied message for unauthorized command.
 */
export function getDeniedMessage(command: string, role: WhatsAppRole): string {
    return [
        `🔒 *Acesso restrito*`,
        ``,
        `O comando *${command}* requer nível *Admin* ou *CEO*.`,
        `Seu nível atual: *${role}*`,
        ``,
        `_Contate seu administrador para solicitar acesso._`,
        ``,
        `Disponíveis para você: /today · /client · /help`
    ].join("\n");
}

// ─── Admin Helpers ────────────────────────────────────────────────────────────

/**
 * Register or update a WhatsApp user.
 */
export async function upsertWhatsAppUser({
    phoneNumber,
    orgId,
    role,
    name,
    userId
}: {
    phoneNumber: string;
    orgId: string;
    role: WhatsAppRole;
    name?: string;
    userId?: string;
}) {
    return prisma.whatsAppUser.upsert({
        where: { phoneNumber_organizationId: { phoneNumber, organizationId: orgId } },
        update: { role, name, userId, active: true, updatedAt: new Date() },
        create: { phoneNumber, organizationId: orgId, role, name, userId }
    });
}

/**
 * Revoke (deactivate) a WhatsApp user.
 */
export async function revokeWhatsAppUser(phoneNumber: string, orgId: string) {
    return prisma.whatsAppUser.updateMany({
        where: { phoneNumber, organizationId: orgId },
        data: { active: false }
    });
}

/**
 * List all WhatsApp users for an org.
 */
export async function listWhatsAppUsers(orgId: string) {
    return prisma.whatsAppUser.findMany({
        where: { organizationId: orgId },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }]
    });
}
