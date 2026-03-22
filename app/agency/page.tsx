import { redirect } from "next/navigation";

import { getAuthContext } from "@/lib/auth/session";

export default async function AgencyEntryPage() {
    const auth = await getAuthContext();

    if (!auth.isAuthenticated || auth.authScope !== "agency") {
        redirect("/agency/login");
    }

    redirect("/agency/dashboard");
}
