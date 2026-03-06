import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { Orchestrator } from "@/lib/orchestrator/orchestrator";
import { can } from "@/lib/auth/rbac";

export async function POST() {
    try {
        const session = await getSession();
        if (!session || !can(session.role, "manageSettings")) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        // Process Action Queue for this org
        await Orchestrator.processQueue(session.orgId);

        return NextResponse.json({ success: true, message: "Queue processed" });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
