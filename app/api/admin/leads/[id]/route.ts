import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("admin_token");

        if (!token || token.value !== "authenticated_true") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = (await params);
        const body = await request.json();

        // Buscando o lead atual para registrar a auditoria
        const currentLead = await prisma.assessment.findUnique({
            where: { id }
        });

        if (!currentLead) {
            return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        }

        // Lógica de atualização
        const updateData: any = {};
        let auditAction = null;
        let auditDetails = null;

        if (body.status && body.status !== currentLead.status) {
            updateData.status = body.status;
            auditAction = "statusChanged";
            auditDetails = JSON.stringify({ from: currentLead.status, to: body.status });
        }

        if (body.internalNotes !== undefined && body.internalNotes !== currentLead.internalNotes) {
            updateData.internalNotes = body.internalNotes;
            auditAction = auditAction ? "multipleUpdates" : "noteAdded";
        }

        // Realizando transação para atualizar Lead e criar AuditEvent
        const updatedLead = await prisma.$transaction(async (tx) => {
            const lead = await tx.assessment.update({
                where: { id },
                data: updateData
            });

            if (auditAction) {
                await tx.auditEvent.create({
                    data: {
                        assessmentId: id,
                        action: auditAction,
                        details: auditDetails
                    }
                });
            }

            return lead;
        });

        return NextResponse.json(updatedLead);

    } catch (error) {
        console.error("[LEAD_PATCH_ERROR]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
