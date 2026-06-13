import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { normalizeOrganizationAccountStatus, organizationAccountStatusLabel } from "@/lib/billing/account-status";

export function AccountStatusBanner({
    slug,
    subscriptionStatus,
}: {
    slug: string;
    subscriptionStatus: string | null | undefined;
}) {
    const status = normalizeOrganizationAccountStatus(subscriptionStatus);

    if (status !== "suspended") {
        return null;
    }

    return (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
                    <div className="space-y-1">
                        <p className="font-semibold">
                            Conta {organizationAccountStatusLabel(status).toLowerCase()}.
                        </p>
                        <p className="text-xs leading-6 text-rose-50/80">
                            As ações de criação e automação ficam bloqueadas até a regularização do billing.
                        </p>
                    </div>
                </div>
                <Link
                    href={`/org/${slug}/admin/billing`}
                    className="inline-flex items-center justify-center rounded-xl border border-rose-200/20 bg-rose-200/10 px-3 py-2 text-xs font-semibold text-rose-50 transition hover:bg-rose-200/15"
                >
                    Abrir billing
                </Link>
            </div>
        </div>
    );
}
