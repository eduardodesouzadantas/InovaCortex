import { redirect } from "next/navigation";

import { requireOrgContext } from "@/lib/auth/org-context";
import { can } from "@/lib/auth/rbac";
import {
    buildOperatorCrmRecordDetail,
    buildOperatorCrmWorkspace,
} from "@/lib/operator/crm-workspace";

import { CrmWorkspaceClient } from "./crm-workspace-client";

export const runtime = "nodejs";

export default async function OperatorCrmPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ assessmentId?: string }>;
}) {
    const { slug } = await params;
    const resolvedSearchParams = searchParams ? await searchParams : {};

    const ctx = await requireOrgContext(slug).catch(() => null);
    if (!ctx || !can(ctx.role, "viewDashboard")) {
        redirect(`/org/${slug}/admin/login`);
    }

    const workspace = await buildOperatorCrmWorkspace(ctx.orgId, slug, ctx.userId);
    const requestedAssessmentId = typeof resolvedSearchParams.assessmentId === "string"
        && workspace.table.records.some((record) => record.id === resolvedSearchParams.assessmentId)
        ? resolvedSearchParams.assessmentId
        : null;
    const initialAssessmentId = requestedAssessmentId ?? workspace.table.records[0]?.id ?? null;
    const initialDetail = initialAssessmentId
        ? await buildOperatorCrmRecordDetail({
            organizationId: ctx.orgId,
            orgSlug: slug,
            assessmentId: initialAssessmentId,
        })
        : null;

    return (
        <CrmWorkspaceClient
            slug={slug}
            initialData={workspace}
            initialDetail={initialDetail}
        />
    );
}
