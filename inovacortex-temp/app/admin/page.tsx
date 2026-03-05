import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Assessment } from "@prisma/client";
import { LogOut, Download, AlertCircle, LayoutDashboard, List } from "lucide-react";
import { AdminActions } from "./admin-actions";
import { KanbanBoard } from "./kanban-board";

export const runtime = "nodejs";

// Server Component for the Admin Page
export default async function AdminPage({
    searchParams,
}: {
    searchParams: Promise<{ filter?: string }>;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_token");

    // Authentication Check
    if (!token || token.value !== "authenticated_true") {
        redirect("/admin/login");
    }

    // Fetch assessments with optional filter
    const { filter } = await searchParams;
    const whereClause = filter ? { classification: filter } : {};

    const assessments = await prisma.assessment.findMany({
        where: whereClause,
        orderBy: { scoreTotal: "desc" },
        include: {
            artifactReport: true,
            messageLogs: {
                orderBy: { createdAt: "desc" },
                take: 1
            },
            assignments: {
                where: { status: "active" },
                include: { salesRep: true },
                take: 1
            }
        },
    });

    return (
        <div className="min-h-screen bg-muted/10 p-8 pt-32">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h1 className="text-3xl font-extrabold text-foreground">Mission Control</h1>
                        <p className="text-muted-foreground mt-1">Visão Geral dos Diagnósticos Capturados</p>
                    </div>
                    <div className="flex gap-3">
                        <a href="/admin/configuracoes" className="px-4 py-2 rounded-lg text-sm font-medium border border-border/50 text-muted-foreground hover:bg-muted transition-colors flex items-center gap-2">
                            ⚙️ Configurações Meta
                        </a>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-4 mb-8">
                    <a href="/admin" className={`px-4 py-2 rounded-lg text-sm font-medium border ${!filter ? 'bg-primary/10 border-primary text-primary' : 'border-border/50 text-muted-foreground hover:bg-muted'}`}>Todos</a>
                    <a href="/admin?filter=Alta prioridade" className={`px-4 py-2 rounded-lg text-sm font-medium border ${filter === 'Alta prioridade' ? 'bg-green-500/10 border-green-500 text-green-500' : 'border-border/50 text-muted-foreground hover:bg-muted'}`}>Alta Prioridade</a>
                    <a href="/admin?filter=Boa oportunidade" className={`px-4 py-2 rounded-lg text-sm font-medium border ${filter === 'Boa oportunidade' ? 'bg-yellow-500/10 border-yellow-500 text-yellow-500' : 'border-border/50 text-muted-foreground hover:bg-muted'}`}>Boa Oportunidade</a>
                    <a href="/admin?filter=Exploratória" className={`px-4 py-2 rounded-lg text-sm font-medium border ${filter === 'Exploratória' ? 'bg-zinc-500/10 border-zinc-500 text-zinc-500' : 'border-border/50 text-muted-foreground hover:bg-muted'}`}>Exploratória</a>
                </div>
                {/* Data view */}
                <div className="mt-4">
                    <KanbanBoard initialLeads={assessments} />
                </div>
            </div>
        </div>
    );
}
