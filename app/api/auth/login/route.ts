export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setSessionCookie } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/login
 * V9: bcrypt + JWT session login.
 * Accepts { email, password, orgSlug? }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });
        }

        // Find user by email
        const user = await (prisma as any).user.findUnique({
            where: { email: email.toLowerCase().trim() },
            include: { organization: true },
        });

        if (!user) {
            logger.warn("Login attempt for unknown email", { email });
            return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
        }

        // Verify password
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
            logger.warn("Login failed — bad password", { email, userId: user.id });
            return NextResponse.json({ error: "Credenciais inválidas" }, { status: 401 });
        }

        // Issue JWT session cookie
        await setSessionCookie({
            userId: user.id,
            orgId: user.organizationId,
            orgSlug: user.organization.slug,
            role: user.role as any,
        });

        logger.info("Login successful", { userId: user.id, orgSlug: user.organization.slug, role: user.role });

        return NextResponse.json({
            success: true,
            orgSlug: user.organization.slug,
            role: user.role,
        });

    } catch (error) {
        logger.error("Login error", { error: String(error) });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
