import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { FileText, CheckCircle2 } from "lucide-react";
import { ContractSignForm } from "./sign-form";

export const runtime = "nodejs";

export default async function ContratoPublicoPage({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;

    const contract = await (prisma as any).contract.findUnique({
        where: { publicSlug: slug },
    });

    if (!contract) notFound();

    // Audit contractViewed (non-blocking, fire-and-forget)
    if (contract.status === "draft" || contract.status === "sent") {
        (prisma as any).auditEvent.create({
            data: {
                organizationId: contract.orgId,
                action: "contractViewed",
                userId: "client:anonymous",
                resourceType: "contract",
                resourceId: contract.id,
                details: JSON.stringify({ slug }),
                ipAddress: "client",
            },
        }).catch(() => null);
    }

    const isSigned = contract.status === "signed";

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <header className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-bold text-sm tracking-tight">InovaCortex</span>
                    <span className="ml-auto text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        Contrato de Prestação de Serviços
                    </span>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12">
                {isSigned ? (
                    /* Already signed state */
                    <div className="mb-10 flex items-center gap-4 p-6 rounded-2xl bg-green-500/10 border border-green-500/30 animate-in fade-in">
                        <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
                        <div>
                            <p className="font-bold text-green-500 text-lg">Contrato Assinado</p>
                            <p className="text-sm text-muted-foreground">
                                Assinado por {contract.signedName} ({contract.signedEmail}) em{" "}
                                {new Date(contract.signedAt).toLocaleDateString("pt-BR", {
                                    day: "2-digit", month: "long", year: "numeric",
                                    hour: "2-digit", minute: "2-digit",
                                })}
                            </p>
                        </div>
                    </div>
                ) : (
                    /* Sign prompt banner */
                    <div className="mb-10 p-6 rounded-2xl bg-primary/5 border border-primary/20">
                        <p className="text-sm text-muted-foreground">
                            Leia o contrato abaixo com atenção. Ao assinar, você concorda com todos os termos e condições descritos.
                        </p>
                    </div>
                )}

                {/* Contract HTML Body */}
                <div
                    className="bg-white text-gray-900 rounded-2xl shadow-xl p-8 md:p-12 mb-12 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: contract.htmlBody }}
                />

                {/* Sign Form */}
                {!isSigned && (
                    <div className="glass-panel rounded-2xl border border-primary/20 p-8">
                        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-sm font-black">✍</span>
                            Assinar Contrato
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            Ao preencher e confirmar abaixo, você declara ter lido e concordado com todos os termos.
                            Este aceite tem validade jurídica conforme a Lei nº 14.063/2020.
                        </p>
                        <ContractSignForm slug={slug} />
                    </div>
                )}

                {/* Footer note */}
                <p className="text-xs text-muted-foreground text-center mt-8">
                    Documento gerado em {new Date(contract.createdAt).toLocaleDateString("pt-BR")} · Versão {contract.version}
                </p>
            </main>
        </div>
    );
}
