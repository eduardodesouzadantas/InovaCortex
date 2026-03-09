/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Assessment } from "@prisma/client";
import { Calendar, CheckCircle2, ChevronRight } from "lucide-react";
import Link from "next/link";
import { AdminActions } from "./admin-actions";

interface KanbanCardProps {
    lead: Partial<Assessment> & {
        whatsappConsent?: boolean;
        artifactReport?: { publicSlug: string } | null;
        messageLogs?: { status: string }[];
        assignments?: any[];
    };
    leadBasePath?: string;
}

export function KanbanCard({ lead, leadBasePath = "/admin" }: KanbanCardProps) {
    const isHighPriority = lead.classification === "Alta prioridade";

    return (
        <div className="bg-background/80 p-4 rounded-xl border border-border/50 shadow-sm hover:shadow-md transition-all group flex flex-col gap-3">
            <div className="flex justify-between items-start">
                <div>
                    <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                        {lead.name?.split(' ')[0]}
                        {isHighPriority && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Alta Prioridade"></span>}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-1">{lead.company}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <div className="text-right">
                        <span className="font-black text-primary text-sm">{lead.scoreTotal}</span><span className="text-[10px] text-muted-foreground">/100</span>
                    </div>
                    {/* Rep Badge */}
                    {lead.assignments && lead.assignments.length > 0 ? (
                        <div
                            className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-[8px] font-bold text-primary"
                            title={`Responsável: ${lead.assignments[0].salesRep.name}`}
                        >
                            {lead.assignments[0].salesRep.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-muted border border-border/50 flex items-center justify-center" title="Sem responsável">
                            <span className="text-[8px] text-muted-foreground">?</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex gap-2 text-[10px] font-medium">
                {lead.whatsappConsent && (
                    <span className="bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> WPP
                    </span>
                )}
                <span className="bg-muted px-1.5 py-0.5 rounded text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {new Date(lead.createdAt || "").toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
            </div>

            <div className="pt-2 mt-auto border-t border-border/30 flex justify-between items-center opacity-60 group-hover:opacity-100 transition-opacity">
                {lead.artifactReport ? (
                    <AdminActions
                        slug={lead.artifactReport.publicSlug}
                        score={lead.scoreTotal!}
                        name={lead.name!.split(' ')[0]}
                        assessmentId={lead.id!}
                        whatsappConsent={lead.whatsappConsent!}
                        lastMessageStatus={lead.messageLogs?.[0]?.status}
                    />
                ) : (
                    <span className="text-[10px] text-muted-foreground italic">Processando...</span>
                )}

                <Link href={`${leadBasePath}/${lead.id}`} className="p-1 hover:bg-muted rounded-md text-foreground transition-colors ml-auto">
                    <ChevronRight className="w-4 h-4" />
                </Link>
            </div>
        </div>
    );
}
