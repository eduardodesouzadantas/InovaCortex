import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth/session";

export async function logoutWithSessionClear() {
    await clearSessionCookie();
    return NextResponse.json({ success: true });
}
