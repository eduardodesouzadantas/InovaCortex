/**
 * app/api/admin/orchestrator/scan-profit-leaks/route.ts
 * V22.1: POST — Trigger a profit leak scan for an org.
 *
 * RBAC: admin only (adminToken header or session).
 * Idempotent: safe to call multiple times per day.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { executeProfitLeakScan } from "@/lib/orchestrator/executors/profit-leak-executor";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const session = await getSession();
    const adminToken = req.headers.get("x-admin-token");
    const envToken = process.env.ADMIN_SECRET_TOKEN;

    const isAuthed =
        (session != null && (session.role === "admin" || session.role === "owner")) ||
        (envToken && adminToken === envToken);

    if (!isAuthed) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Body ──────────────────────────────────────────────────────────────────
    let body: { orgId?: string };
    try { body = await req.json(); }
    catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

    if (!body.orgId) {
        return NextResponse.json({ error: "orgId required" }, { status: 400 });
    }

    // ── Execute ───────────────────────────────────────────────────────────────
    logger.info("[ScanProfitLeaks] Starting", { orgId: body.orgId });

    const result = await executeProfitLeakScan({ orgId: body.orgId });

    if (!result.success) {
        return NextResponse.json({ error: "Scan failed" }, { status: 500 });
    }

    return NextResponse.json({
        ok: true,
        leaksCreated: result.leaksCreated,
        leaksUpdated: result.leaksUpdated,
        snapshot: result.snapshot,
        scannedAt: new Date().toISOString(),
    });
}
