export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        // In V1, we use env variables for a fast admin setup
        const secretAdminEmail = process.env.ADMIN_EMAIL;
        const secretAdminPass = process.env.ADMIN_PASSWORD;

        if (!secretAdminPass || !secretAdminEmail) {
            return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
        }

        if (email === secretAdminEmail && password === secretAdminPass) {
            // Set httpOnly cookie
            const cookieStore = await cookies();
            cookieStore.set({
                name: "admin_token",
                value: "authenticated_true", // In prod, this should be a JWT signed with a secret
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                path: "/",
                maxAge: 60 * 60 * 24 // 1 day
            });

            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
