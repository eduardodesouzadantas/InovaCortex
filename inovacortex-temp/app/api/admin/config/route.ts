import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { encrypt, maskToken, isEncrypted } from "@/lib/security/crypto";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/admin/config
 * Save Meta API settings, encrypting values before storing in DB.
 * Body: [{ key: string, value: string }]
 */
export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("admin_token");

        if (!token || token.value !== "authenticated_true") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        if (!Array.isArray(body)) {
            return NextResponse.json({ error: "Invalid format. Expected array." }, { status: 400 });
        }

        const upsertPromises = body
            .filter((s: { key: string; value: string }) => s.key && s.value !== undefined)
            .map((setting: { key: string; value: string }) => {
                // Only encrypt if a real value is provided and it's not already encrypted
                const valueToStore = setting.value
                    ? (isEncrypted(setting.value) ? setting.value : encrypt(setting.value))
                    : setting.value;

                return (prisma as any).systemSetting.upsert({
                    where: { key: setting.key },
                    update: { value: valueToStore },
                    create: { key: setting.key, value: valueToStore },
                });
            });

        await prisma.$transaction(upsertPromises);

        // Audit: log token updates (without exposing actual values)
        const updatedKeys = body.map((s: { key: string }) => s.key);
        await logAudit("token", "system", "updated", { keys: updatedKeys });

        logger.info("System settings updated", { keys: updatedKeys });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        logger.error("Config route error", { error: e?.message });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}

/**
 * GET /api/admin/config
 * Return masked (never real) token values for display in the settings UI.
 */
export async function GET(_request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("admin_token");

        if (!token || token.value !== "authenticated_true") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const settings = await (prisma as any).systemSetting.findMany();

        // Return only masked values — never expose raw or decrypted tokens
        const masked = settings.map((s: any) => ({
            key: s.key,
            masked: maskToken(s.value),
            configured: !!s.value,
        }));

        return NextResponse.json({ settings: masked });
    } catch (e: any) {
        logger.error("Config GET error", { error: e?.message });
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
