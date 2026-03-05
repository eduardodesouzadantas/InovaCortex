import { prisma } from "@/lib/prisma";
import { getCached, setCached, makeCacheKey } from "@/lib/agentops/cache";
import { logger } from "@/lib/logger";

export interface CommandResult {
    title: string;
    resumo: string;
    dados: Record<string, any>;
    acoes: string[];
    atalhos: string[];
    meta: {
        timestamp: string;
        cached: boolean;
        ttlSeconds: number;
    };
}

/**
 * lib/ai/command-engine.ts
 * 100% Deterministic execution of AI Control Room commands.
 */
export const CommandEngine = {
    /**
     * Parse raw string input into command type and args.
     */
    parseInput(input: string): { type: "command" | "chat"; command?: string; args?: string } {
        const trimmed = input.trim();
        if (trimmed.startsWith("/")) {
            const [cmd, ...rest] = trimmed.split(" ");
            return {
                type: "command",
                command: cmd.toLowerCase(),
                args: rest.join(" ")
            };
        }
        return { type: "chat" };
    },

    /**
     * Execute a deterministic command with caching.
     */
    async executeCommand(
        orgId: string,
        userId: string,
        role: string,
        command: string,
        args?: string
    ): Promise<CommandResult> {
        const ttlMap: Record<string, number> = {
            "/pipeline": 60,
            "/today": 60,
            "/revenue": 300,
            "/growth": 300,
            "/leaks": 600,
            "/playbook": 1800,
            "/objections": 1800,
            "/client": 120,
            "/test-strategy": 0, // No cache — highly personalized
            "/team": 60,
            "/rep": 60,
            "/assign": 0,
            "/sla": 60,
            "/strategy": 300,
            "/experiment": 300,
            "/focus": 0,
            "/run": 0,
            "/help": 3600
        };

        const ttl = ttlMap[command] || 60;
        const cacheKey = makeCacheKey("CommandEngine", command, { orgId, args, role }).keyHash;

        // 1. Try Cache
        const hit = await getCached(orgId, cacheKey, ttl * 1000);
        if (hit) {
            return {
                ...(hit.output as any),
                meta: { ...(hit.output as any).meta, cached: true }
            };
        }

        // 2. Execute Deterministic Logic
        let result: Partial<CommandResult>;

        switch (command) {
            case "/pipeline":
                result = await this.renderPipeline(orgId);
                break;
            case "/leaks":
                result = await this.renderLeaks(orgId);
                break;
            case "/today":
                result = await this.renderToday(orgId);
                break;
            case "/revenue":
                result = await this.renderRevenue(orgId);
                break;
            case "/growth":
                result = await this.renderGrowth(orgId);
                break;
            case "/playbook":
                result = await this.renderPlaybook(orgId);
                break;
            case "/client":
                result = await this.renderClient(orgId, args);
                break;
            case "/objections":
                result = await this.renderObjections(orgId);
                break;
            case "/test-strategy":
                result = await this.renderTestStrategy(orgId, args);
                break;
            case "/team":
                result = await this.renderTeam(orgId);
                break;
            case "/rep":
                result = await this.renderRep(orgId, args);
                break;
            case "/assign":
                result = await this.renderAssign();
                break;
            case "/sla":
                result = await this.renderSLA(orgId);
                break;
            case "/strategy":
                result = await this.renderStrategy(orgId);
                break;
            case "/experiment":
                result = await this.renderExperiment(orgId);
                break;
            case "/focus":
                result = await this.renderFocus(orgId, args);
                break;
            case "/run":
                result = await this.renderRun(orgId, userId, args);
                break;
            case "/help":
            default:
                result = this.renderHelp();
        }

        const finalResult: CommandResult = {
            title: result.title || "Resultado",
            resumo: result.resumo || "",
            dados: result.dados || {},
            acoes: result.acoes || [],
            atalhos: result.atalhos || ["/help"],
            meta: {
                timestamp: new Date().toISOString(),
                cached: false,
                ttlSeconds: ttl
            }
        };

        // 3. Set Cache
        await setCached(orgId, cacheKey, {
            agentName: "CommandEngine",
            model: "deterministic",
            inputObj: { orgId, args, role },
            outputObj: finalResult
        });

        return finalResult;
    },

    async renderPipeline(orgId: string) {
        const [assessments, meetings, proposals, dealPackets, dealsWithWin] = await Promise.all([
            prisma.assessment.count({ where: { organizationId: orgId } }),
            (prisma as any).meetingSession.count({ where: { organizationId: orgId } }),
            prisma.proposal.count({ where: { assessment: { organizationId: orgId } } }),
            (prisma as any).dealPacket.count({ where: { orgId } }),
            (prisma as any).meetingPerformance.count({ where: { organizationId: orgId, outcome: 'won' } })
        ]);

        return {
            title: "Pipeline Intelligence",
            resumo: `Monitoramento completo do funil para sua organização.`,
            dados: {
                "Leads (Assessments)": assessments,
                "Meetings": meetings,
                "Propostas": proposals,
                "Pacotes de Fechamento": dealPackets,
                "Conversão (Won)": dealsWithWin,
                "trends": [12, 19, 15, 22, 30, 25, 35] // Mock trend for sparkline
            },
            acoes: [
                "Verificar DealPackets parados.",
                "Escalar follow-up de propostas visualizadas."
            ],
            atalhos: ["/leaks", "/revenue"]
        };
    },

    async renderLeaks(orgId: string) {
        const { scanRevenueLeaks } = await import("@/lib/analytics/leak-detector");
        const analysis = await scanRevenueLeaks(orgId);

        return {
            title: "Revenue Leakage Detector",
            resumo: analysis.leakItems.length > 0
                ? `Detectamos R$ ${(analysis.totalLeakValue / 100).toLocaleString('pt-BR')} em vazamentos de receita críticos.`
                : "Nenhum vazamento de receita crítico detectado no momento.",
            dados: Object.fromEntries(analysis.leakItems.map(item => [item.label, item.value])),
            acoes: analysis.leakItems.map(item => `Intervir: ${item.description}`),
            atalhos: ["/revenue", "/pipeline"]
        };
    },

    async renderToday(orgId: string) {
        const { generateDailyActions } = await import("@/lib/analytics/action-engine");
        const { actions } = await generateDailyActions(orgId);

        return {
            title: "Priority Actions Today",
            resumo: actions.length > 0
                ? `Você tem ${actions.length} ações prioritárias focadas em receita e tração.`
                : "Nenhuma ação crítica pendente para hoje.",
            dados: Object.fromEntries(actions.map((a, i) => [`${i + 1}. ${a.label}`, a.impact])),
            acoes: actions.map(a => `${a.label}: ${a.description}`),
            atalhos: ["/revenue", "/leaks", "/growth"]
        };
    },

    async renderRevenue(orgId: string) {
        const { computeRevenueOpportunities } = await import("@/lib/analytics/revenue-brain");
        const ops = await computeRevenueOpportunities(orgId);

        return {
            title: "Revenue Brain",
            resumo: `Identificamos R$ ${(ops.totalOpportunity / 100).toLocaleString('pt-BR')} em oportunidades de alta probabilidade prontos para fechamento.`,
            dados: {
                "Oportunidade Total": `R$ ${(ops.totalOpportunity / 100).toLocaleString('pt-BR')}`,
                "Deals Quentes": ops.highProbabilityDeals.length,
                "Leads Parados": ops.stalledDeals.length,
                "Vitórias Rápidas": ops.fastWins.join(", ") || "Nenhuma detectada",
                "trends": [4000, 4500, 4200, 5000, 6000, 5800, 7500]
            },
            acoes: ops.recommendations,
            atalhos: ["/leaks", "/pipeline"]
        };
    },

    async renderGrowth(orgId: string) {
        const [prospects, sequences, messages, signals] = await Promise.all([
            (prisma as any).prospect.count({ where: { orgId } }),
            (prisma as any).outboundSequence.count({ where: { orgId } }),
            (prisma as any).outboundMessage.count({ where: { orgId, status: "sent" } }),
            (prisma as any).growthSignal.count({ where: { organizationId: orgId } })
        ]);

        return {
            title: "Growth & Outbound Engine",
            resumo: `Métricas de tração e sinais de interesse detectados pelo Autopilot.`,
            dados: {
                "Total Prospectos": prospects,
                "Sequências Ativas": sequences,
                "Mensagens Enviadas": messages,
                "Sinais de Crescimento": signals
            },
            acoes: [
                "Escalar outbound para novos nichos.",
                "Responder sinais de alta prioridade."
            ],
            atalhos: ["/today"]
        };
    },

    async renderPlaybook(orgId: string) {
        // Real data: top playbooks from MeetingPerformance won
        const wonMeetings = await (prisma as any).meetingPerformance.findMany({
            where: { organizationId: orgId, outcome: "won" },
            orderBy: { closedValue: "desc" },
            take: 10
        });

        const { MemoryEngine } = await import("./memory-engine");
        const savedPlaybooks = await MemoryEngine.searchMemories(orgId, undefined, ["playbook", "win_reason"], 5);

        const winPatterns = wonMeetings.map((m: any) =>
            `✅ ${m.notes?.slice(0, 100) || "Reunião ganha"} — R$ ${(m.closedValue || 0) / 100}`
        );

        return {
            title: "Top Playbooks de Conversão",
            resumo: wonMeetings.length > 0
                ? `Identificados ${wonMeetings.length} padrões de vitória no seu pipeline. Esses são os playbooks que mais convertem.`
                : "Nenhuma reunião ganha registrada ainda.",
            dados: {
                "Reuniões Ganhas": wonMeetings.length,
                "Valor Total (Won)": `R$ ${wonMeetings.reduce((s: number, m: any) => s + (m.closedValue || 0), 0) / 100}`,
                "Playbooks Salvos": savedPlaybooks.length,
                "Top Padrões": winPatterns.slice(0, 3)
            },
            acoes: savedPlaybooks.map((p: any) => `📖 ${p.text.slice(0, 120)}`),
            atalhos: ["/client", "/objections", "/pipeline"]
        };
    },

    async renderClient(orgId: string, args?: string) {
        if (!args?.trim()) {
            return {
                title: "Client Lookup",
                resumo: "Use: /client <nome ou ID do lead>",
                dados: {},
                acoes: ["Exemplo: /client Aurora Tech"],
                atalhos: ["/pipeline"]
            };
        }

        const term = args.trim();
        const assessments = await (prisma as any).assessment.findMany({
            where: {
                organizationId: orgId,
                OR: [
                    { name: { contains: term, mode: "insensitive" } },
                    { company: { contains: term, mode: "insensitive" } },
                    { id: term }
                ]
            },
            include: {
                proposals: { orderBy: { createdAt: "desc" }, take: 1 }
            },
            take: 3
        });

        if (assessments.length === 0) {
            return {
                title: `Cliente: "${term}"`,
                resumo: "Nenhum cliente encontrado com esse nome ou ID.",
                dados: {},
                acoes: ["Verifique o nome e tente novamente."],
                atalhos: ["/pipeline"]
            };
        }

        const a = assessments[0];
        const latestProposal = (a as any).proposals?.[0];

        return {
            title: `Cliente: ${a.company} (${a.name})`,
            resumo: `Histórico completo do cliente ${a.company} — Score: ${a.classification || "—"}`,
            dados: {
                "Lead": a.name,
                "Empresa": a.company,
                "Segmento": a.segment,
                "Score": a.classification || "—",
                "Status": a.status,
                "Criado em": a.createdAt.toLocaleDateString("pt-BR"),
                "Última Proposta": latestProposal
                    ? `Status: ${latestProposal.status} | ${latestProposal.createdAt.toLocaleDateString("pt-BR")}`
                    : "Nenhuma proposta",
                "Dores": a.pains || "—"
            },
            acoes: [
                latestProposal?.status === "sent" ? "📩 Follow-up pendente na proposta enviada." : "📋 Criar nova proposta.",
                `🎯 Score ${a.classification} — ${a.classification === "hot" ? "Prioridade máxima." : "Monitorar."}`
            ],
            atalhos: ["/playbook", "/pipeline"]
        };
    },

    async renderObjections(orgId: string) {
        // Fetch objection memories
        const { MemoryEngine } = await import("./memory-engine");
        const objections = await MemoryEngine.searchMemories(orgId, undefined, ["objection"], 10);

        // Cross-reference with won meetings to find winning responses
        const wonMeetings = await (prisma as any).meetingPerformance.findMany({
            where: { organizationId: orgId, outcome: "won" },
            orderBy: { closedValue: "desc" },
            take: 5
        });

        const topObjections = objections.slice(0, 5).map((o: any, i: number) => ({
            [`Objeção ${i + 1}`]: o.text.slice(0, 120),
            [`Confiança`]: `${o.confidence}/10`
        }));

        return {
            title: "Top Objeções & Respostas Vencedoras",
            resumo: objections.length > 0
                ? `${objections.length} objeções catalogadas. Reuniões ganhas: ${wonMeetings.length}. Use esses padrões para fechar mais rápido.`
                : "Nenhuma objeção catalogada ainda. Chat com a IA e diga '/memory salvar objeção: [descrição]'.",
            dados: Object.assign({}, ...topObjections, {
                "Meetings Won (contexto)": wonMeetings.length,
                "Ticket Médio Won": wonMeetings.length > 0
                    ? `R$ ${wonMeetings.reduce((s: number, m: any) => s + (m.closedValue || 0), 0) / wonMeetings.length / 100}`
                    : "—"
            }),
            acoes: objections.length > 0
                ? objections.slice(0, 3).map((o: any) => `💬 "${o.text.slice(0, 80)}"`)
                : ["Registre objeções para melhorar os playbooks de vendas."],
            atalhos: ["/playbook", "/test-strategy"]
        };
    },

    async renderTestStrategy(orgId: string, args?: string) {
        if (!args?.trim()) {
            return {
                title: "Test Strategy",
                resumo: "Use: /test-strategy <mensagem de follow-up ou pitch>",
                dados: {},
                acoes: ["Exemplo: /test-strategy Oi João, passando para ver se teve chance de ver a proposta..."],
                atalhos: ["/playbook", "/objections"]
            };
        }

        // Semantic analysis with internal RAG
        const { buildRagContext } = await import("@/lib/memory/rag-context");
        const rag = await buildRagContext(orgId, args);

        // Heuristic analysis (deterministic, no LLM cost)
        const tone = detectTone(args);
        const cta = detectCTA(args);
        const riskFlags: string[] = [];

        if (args.toLowerCase().includes("só queria")) riskFlags.push("⚠️ Tom passivo — evite 'só queria'");
        if (args.length > 300) riskFlags.push("⚠️ Mensagem longa — considere resumir");
        if (!cta) riskFlags.push("⚠️ Sem CTA claro — adicione um próximo passo");
        if (args.toLowerCase().includes("qualquer dúvida")) riskFlags.push("⚠️ CTA fraco — 'qualquer dúvida' não compromete");

        const suggestions = [
            riskFlags.length === 0 ? "✅ Mensagem com bom equilíbrio." : riskFlags[0],
            rag.chunkCount > 0 ? `📚 ${rag.chunkCount} evidências internas encontradas para reforçar o argumento.` : "💡 Adicione evidências de cases similares.",
            !cta ? "➡️ Sugestão: termine com 'Conseguimos agendar 15min ainda essa semana?'" : `✅ CTA detectado: "${cta}"`
        ];

        return {
            title: "Análise de Estratégia de Mensagem",
            resumo: `Analisando: "${args.slice(0, 60)}..."`,
            dados: {
                "Tom": tone,
                "CTA Detectado": cta || "Nenhum",
                "Riscos": riskFlags.length,
                "Evidências Internas": rag.chunkCount,
                "Pontuação Estimada": riskFlags.length === 0 ? "8/10 🟢" : riskFlags.length === 1 ? "5/10 🟡" : "3/10 🔴"
            },
            acoes: suggestions,
            atalhos: ["/objections", "/playbook"]
        };
    },

    renderHelp() {
        return {
            title: "Control Room Help",
            resumo: "Lista de comandos disponíveis.",
            dados: {
                "/pipeline": "Resumo do funil comercial.",
                "/leaks": "Detecção de perdas financeiras.",
                "/today": "Agenda e ações do dia.",
                "/revenue": "Performance financeira e ROI.",
                "/team": "Ranking do time e faturamento.",
                "/rep <nome>": "Detalhes de performance por vendedor.",
                "/sla": "Leads parados por responsável.",
                "/playbook": "Top playbooks que mais convertem.",
                "/client <nome>": "Histórico e status de um cliente.",
                "/objections": "Top objeções + respostas.",
                "/test-strategy": "Análise de pitch/follow-up."
            },
            acoes: ["Experimente digitar /client <nome do seu lead principal>."],
            atalhos: ["/pipeline", "/leaks", "/today", "/revenue", "/team", "/sla"]
        };
    },

    async renderTeam(orgId: string) {
        const { getLeaderboard } = await import("@/lib/sales/stats-engine");
        const { scanSLABreaches } = await import("@/lib/sales/sla-engine");
        const month = new Date().toISOString().slice(0, 7);

        const [leaderboard, breaches] = await Promise.all([
            getLeaderboard(orgId, month),
            scanSLABreaches(orgId, 48)
        ]);

        const topReps = leaderboard.slice(0, 3).map(r => `${r.rank}. ${r.name} (R$ ${r.totalRevenueCents / 100})`);
        const atRiskReps = Array.from(new Set(breaches.map(b => b.repName))).slice(0, 2);

        return {
            title: "Sales Team Leaderboard",
            resumo: `Faturamento Total: R$ ${leaderboard.reduce((s, r) => s + r.totalRevenueCents, 0) / 100}.`,
            dados: {
                "Ranking": topReps.join(", "),
                "SLA Breaches": breaches.length,
                "Reps em Risco": atRiskReps.join(", ") || "Nenhum"
            },
            acoes: [
                breaches.length > 0 ? `⚠️ ${breaches.length} leads parados. Digite /sla para detalhes.` : "✅ SLA em dia.",
                "Parabenizar top closers pelo faturamento."
            ],
            atalhos: ["/leaderboard", "/sla", "/revenue"]
        };
    },

    async renderRep(orgId: string, args?: string) {
        if (!args?.trim()) {
            return { title: "Rep Detail", resumo: "Use: /rep <nome>", dados: {}, acoes: ["Exemplo: /rep Ricardo"], atalhos: ["/team"] };
        }

        const term = args.trim();
        const rep = await (prisma as any).salesRep.findFirst({
            where: { organizationId: orgId, name: { contains: term, mode: "insensitive" } }
        });

        if (!rep) {
            return { title: "Rep not found", resumo: `Nenhum vendedor encontrado com o nome "${term}".`, dados: {}, acoes: ["Verifique o nome no dashboard."], atalhos: ["/team"] };
        }

        const { getRepStats } = await import("@/lib/sales/stats-engine");
        const stats = await getRepStats(rep.id, new Date().toISOString().slice(0, 7));

        if (!stats) return { title: "No stats", resumo: "Erro ao buscar estatísticas.", dados: {}, acoes: [], atalhos: [] };

        return {
            title: `Performance: ${rep.name}`,
            resumo: `Perfil de ${rep.role} — Win-rate: ${stats.winRate}%`,
            dados: {
                "Revenue (Mês)": `R$ ${stats.totalRevenueCents / 100}`,
                "Meta": `${stats.targetPct}%`,
                "Leads Ativos": stats.totalLeads,
                "Avg Ticket": `R$ ${stats.avgTicketCents / 100}`,
                "Tempo p/ Fechar": `${stats.avgDaysToClose} dias`
            },
            acoes: [
                stats.targetPct < 50 ? "⚠️ Rep abaixo de 50% da meta. Oferecer suporte." : "🚀 Excelente performance.",
                "Ver detalhes no Dashboard de Vendas."
            ],
            atalhos: ["/team", "/sla"]
        };
    },

    async renderAssign() {
        return {
            title: "Atribuição de Leads",
            resumo: "Comando executivo bloqueado no WhatsApp.",
            dados: {
                "Instrução": "Para atribuir leads, use o Dashboard de Vendas ou o Admin Lead Detail."
            },
            acoes: ["Acesse /admin/[id] para atribuir manualmente."],
            atalhos: ["/team", "/pipeline"]
        };
    },

    async renderSLA(orgId: string) {
        const { scanSLABreaches, groupBreachesByRep } = await import("@/lib/sales/sla-engine");
        const breaches = await scanSLABreaches(orgId, 48);
        const grouped = groupBreachesByRep(breaches);

        const summary = grouped.slice(0, 3).map(g => `${g.rep.name}: ${g.breaches.length} leads`);

        return {
            title: "SLA Risk Queue",
            resumo: breaches.length > 0
                ? `Existem ${breaches.length} leads quentes ou mornos sem follow-up a mais de 48h.`
                : "Parabéns! Nenhuma quebra de SLA detectada.",
            dados: {
                "Total de Riscos": breaches.length,
                "Top Reps em Falta": summary.join(", ") || "Nenhum"
            },
            acoes: breaches.length > 0
                ? [`Notificar ${breaches[0].repName} sobre o lead ${breaches[0].company}.`]
                : ["Continue monitorando a saúde do pipeline."],
            atalhos: ["/team", "/today"]
        };
    },

    async renderStrategy(orgId: string) {
        const { runStrategyAnalysis } = await import("../strategy/strategy-engine");
        const analysis = await runStrategyAnalysis(orgId);

        return {
            title: "Executive Strategy Insights",
            resumo: `Análise de 30 dias: ${analysis.recommendations.length} recomendações críticas para crescimento.`,
            dados: {
                "Conversão": `${analysis.kpis.proposalAcceptanceRate.toFixed(1)}%`,
                "Show-Rate": `${analysis.kpis.meetingShowRate.toFixed(1)}%`,
                "Gargalos": analysis.bottlenecks.length,
                "Top Reco": analysis.recommendations[0]?.title || "Nenhuma detectada"
            },
            acoes: analysis.recommendations.slice(0, 3).map(r => `💡 ${r.title}: ${r.summary.slice(0, 60)}...`),
            atalhos: ["/experiment", "/pipeline", "/revenue"]
        };
    },

    async renderExperiment(orgId: string) {
        const { runStrategyAnalysis } = await import("../strategy/strategy-engine");
        const { buildExperimentDrafts } = await import("../strategy/experiments");
        const analysis = await runStrategyAnalysis(orgId);

        const topBottleneck = analysis.bottlenecks[0];
        const drafts = topBottleneck ? buildExperimentDrafts(topBottleneck.type) : [];

        return {
            title: "Growth Experiments (Drafts)",
            resumo: topBottleneck
                ? `Sugestões para resolver gargalo de: ${topBottleneck.type}`
                : "Seu funil parece saudável. Abaixo, sugestões gerais de otimização.",
            dados: Object.fromEntries(drafts.slice(0, 3).map(d => [d.metricKey, d.hypothesis])),
            acoes: drafts.slice(0, 3).map(d => `🧪 ICE Score ${d.score.toFixed(1)}: ${d.hypothesis.slice(0, 50)}`),
            atalhos: ["/strategy", "/focus"]
        };
    },

    async renderFocus(orgId: string, args?: string) {
        if (!args) {
            return { title: "Strategy Focus", resumo: "Use: /focus <industry|offer|channel>", dados: {}, acoes: [], atalhos: [] };
        }

        await prisma.systemSetting.upsert({
            where: { key_organizationId: { key: 'strategy_focus', organizationId: orgId } },
            create: { key: 'strategy_focus', organizationId: orgId, value: args },
            update: { value: args }
        });

        return {
            title: "Focus Updated",
            resumo: `Foco estratégico definido para: ${args}.`,
            dados: { "Novo Foco": args },
            acoes: ["A engine de recomendações agora priorizará esse pilar."],
            atalhos: ["/strategy"]
        };
    },

    async renderRun(orgId: string, userId: string, args?: string) {
        if (!args) {
            return { title: "Run Playbook", resumo: "Use: /run <pb_name>", dados: {}, acoes: [], atalhos: [] };
        }

        const playbookId = args.trim();

        // Trigger run via ActionQueue
        const job = await prisma.actionQueue.create({
            data: {
                organizationId: orgId,
                type: "playbook_run",
                priority: "high",
                payloadJson: JSON.stringify({ playbookId, actorUserId: userId, dryRun: false })
            }
        });

        return {
            title: "Playbook Engine",
            resumo: `Iniciando execução do playbook: ${playbookId}`,
            dados: { "Queue ID": job.id, "Status": "Queued" },
            acoes: ["Acompanhe o andamento no Execution Center."],
            atalhos: ["/playbook"]
        };
    }
};

// ─── Heuristic helpers ────────────────────────────────────────────────────────

function detectTone(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes("urgente") || lower.includes("último")) return "🔴 Urgência/pressão";
    if (lower.includes("empolgad") || lower.includes("animad")) return "🟡 Entusiasta";
    if (lower.includes("só queria") || lower.includes("apenas")) return "⚪ Passivo";
    if (lower.includes("oportunidade") || lower.includes("resultado")) return "🟢 Orientado a valor";
    return "🔵 Neutro";
}

function detectCTA(text: string): string | null {
    const patterns = [
        /pode(mos)? (agendar|marcar|conversar)/i,
        /que tal (uma|um) (reunião|call|conversa)/i,
        /disponível (essa|esta) semana/i,
        /me diz (um horário|quando)/i,
        /link (para agendar|de agenda)/i
    ];
    for (const p of patterns) {
        const match = text.match(p);
        if (match) return match[0];
    }
    return null;
}


