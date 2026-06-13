import { prisma } from "@/lib/prisma";
import { getCached, makeCacheKey, setCached } from "@/lib/agentops/cache";

type CommandData = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export interface CommandResult {
    title: string;
    resumo: string;
    dados: CommandData;
    acoes: string[];
    atalhos: string[];
    meta: {
        timestamp: string;
        cached: boolean;
        ttlSeconds: number;
    };
}

function isCommandResult(value: unknown): value is CommandResult {
    return isRecord(value)
        && typeof value.title === "string"
        && typeof value.resumo === "string"
        && isRecord(value.dados)
        && Array.isArray(value.acoes)
        && Array.isArray(value.atalhos)
        && isRecord(value.meta);
}

type PartialCommandResult = Omit<CommandResult, "meta">;

const COMMAND_TTLS: Record<string, number> = {
    "/pipeline": 60,
    "/today": 60,
    "/revenue": 300,
    "/growth": 300,
    "/leaks": 600,
    "/playbook": 1800,
    "/objections": 1800,
    "/client": 120,
    "/test-strategy": 0,
    "/team": 60,
    "/rep": 60,
    "/assign": 0,
    "/sla": 60,
    "/strategy": 300,
    "/experiment": 300,
    "/focus": 0,
    "/run": 0,
    "/help": 3600,
};

function finalizeCommandResult(result: PartialCommandResult, ttl: number): CommandResult {
    return {
        title: result.title || "Resultado",
        resumo: result.resumo || "",
        dados: result.dados || {},
        acoes: result.acoes || [],
        atalhos: result.atalhos || ["/help"],
        meta: {
            timestamp: new Date().toISOString(),
            cached: false,
            ttlSeconds: ttl,
        },
    };
}

export const CommandEngine = {
    parseInput(input: string): { type: "command" | "chat"; command?: string; args?: string } {
        const trimmed = input.trim();
        if (!trimmed.startsWith("/")) return { type: "chat" };

        const [command, ...rest] = trimmed.split(" ");
        return {
            type: "command",
            command: command.toLowerCase(),
            args: rest.join(" ").trim() || undefined,
        };
    },

    async executeCommand(
        orgId: string,
        userId: string,
        role: string,
        command: string,
        args?: string,
    ): Promise<CommandResult> {
        const ttl = COMMAND_TTLS[command] ?? 60;
        const cacheKey = makeCacheKey("CommandEngine", command, { orgId, args, role }).keyHash;
        const hit = await getCached(orgId, cacheKey, ttl * 1000);

        if (isCommandResult(hit?.output)) {
            return {
                ...hit.output,
                meta: { ...hit.output.meta, cached: true },
            };
        }

        let partial: PartialCommandResult;
        switch (command) {
            case "/pipeline":
                partial = await this.renderPipeline(orgId);
                break;
            case "/leaks":
                partial = await this.renderLeaks(orgId);
                break;
            case "/today":
                partial = await this.renderToday(orgId);
                break;
            case "/revenue":
                partial = await this.renderRevenue(orgId);
                break;
            case "/growth":
                partial = await this.renderGrowth(orgId);
                break;
            case "/playbook":
                partial = await this.renderPlaybook(orgId);
                break;
            case "/client":
                partial = await this.renderClient(orgId, args);
                break;
            case "/objections":
                partial = await this.renderObjections(orgId);
                break;
            case "/test-strategy":
                partial = await this.renderTestStrategy(orgId, args);
                break;
            case "/team":
                partial = await this.renderTeam(orgId);
                break;
            case "/rep":
                partial = await this.renderRep(orgId, args);
                break;
            case "/assign":
                partial = await this.renderAssign();
                break;
            case "/sla":
                partial = await this.renderSLA(orgId);
                break;
            case "/strategy":
                partial = await this.renderStrategy(orgId);
                break;
            case "/experiment":
                partial = await this.renderExperiment(orgId);
                break;
            case "/focus":
                partial = await this.renderFocus(orgId, args);
                break;
            case "/run":
                partial = await this.renderRun(orgId, userId, args);
                break;
            case "/help":
            default:
                partial = this.renderHelp();
                break;
        }

        const result = finalizeCommandResult(partial, ttl);
        await setCached(orgId, cacheKey, {
            agentName: "CommandEngine",
            model: "deterministic",
            inputObj: { orgId, args, role },
            outputObj: result,
        });

        return result;
    },

    async renderPipeline(orgId: string): Promise<PartialCommandResult> {
        const [assessments, meetings, proposals, dealPackets, dealsWithWin] = await Promise.all([
            prisma.assessment.count({ where: { organizationId: orgId } }),
            prisma.meetingSession.count({ where: { organizationId: orgId } }),
            prisma.proposal.count({ where: { assessment: { organizationId: orgId } } }),
            prisma.dealPacket.count({ where: { orgId } }),
            prisma.meetingPerformance.count({ where: { organizationId: orgId, outcome: "won" } }),
        ]);

        return {
            title: "Pipeline Intelligence",
            resumo: "Monitoramento completo do funil para sua organizacao.",
            dados: {
                "Leads (Assessments)": assessments,
                Meetings: meetings,
                Propostas: proposals,
                "Pacotes de Fechamento": dealPackets,
                "Conversao (Won)": dealsWithWin,
                trends: [12, 19, 15, 22, 30, 25, 35],
            },
            acoes: [
                "Verificar DealPackets parados.",
                "Escalar follow-up de propostas visualizadas.",
            ],
            atalhos: ["/leaks", "/revenue"],
        };
    },

    async renderLeaks(orgId: string): Promise<PartialCommandResult> {
        const { scanRevenueLeaks } = await import("@/lib/analytics/leak-detector");
        const analysis = await scanRevenueLeaks(orgId);

        return {
            title: "Revenue Leakage Detector",
            resumo: analysis.leakItems.length > 0
                ? `Detectamos R$ ${(analysis.totalLeakValue / 100).toLocaleString("pt-BR")} em vazamentos de receita criticos.`
                : "Nenhum vazamento de receita critico detectado no momento.",
            dados: Object.fromEntries(analysis.leakItems.map((item) => [item.label, item.value])),
            acoes: analysis.leakItems.map((item) => `Intervir: ${item.description}`),
            atalhos: ["/revenue", "/pipeline"],
        };
    },

    async renderToday(orgId: string): Promise<PartialCommandResult> {
        const { generateDailyActions } = await import("@/lib/analytics/action-engine");
        const { actions } = await generateDailyActions(orgId);

        return {
            title: "Priority Actions Today",
            resumo: actions.length > 0
                ? `Voce tem ${actions.length} acoes prioritarias focadas em receita e tracao.`
                : "Nenhuma acao critica pendente para hoje.",
            dados: Object.fromEntries(actions.map((action, index) => [`${index + 1}. ${action.label}`, action.impact])),
            acoes: actions.map((action) => `${action.label}: ${action.description}`),
            atalhos: ["/revenue", "/leaks", "/growth"],
        };
    },

    async renderRevenue(orgId: string): Promise<PartialCommandResult> {
        const { computeRevenueOpportunities } = await import("@/lib/analytics/revenue-brain");
        const ops = await computeRevenueOpportunities(orgId);

        return {
            title: "Revenue Brain",
            resumo: `Identificamos R$ ${(ops.totalOpportunity / 100).toLocaleString("pt-BR")} em oportunidades de alta probabilidade prontas para fechamento.`,
            dados: {
                "Oportunidade Total": `R$ ${(ops.totalOpportunity / 100).toLocaleString("pt-BR")}`,
                "Deals Quentes": ops.highProbabilityDeals.length,
                "Leads Parados": ops.stalledDeals.length,
                "Vitorias Rapidas": ops.fastWins.join(", ") || "Nenhuma detectada",
                trends: [4000, 4500, 4200, 5000, 6000, 5800, 7500],
            },
            acoes: ops.recommendations,
            atalhos: ["/leaks", "/pipeline"],
        };
    },

    async renderGrowth(orgId: string): Promise<PartialCommandResult> {
        const [prospects, sequences, messages, signals] = await Promise.all([
            prisma.prospect.count({ where: { orgId } }),
            prisma.outboundSequence.count({ where: { orgId } }),
            prisma.outboundMessage.count({ where: { orgId, status: "sent" } }),
            prisma.growthSignal.count({ where: { organizationId: orgId } }),
        ]);

        return {
            title: "Growth & Outbound Engine",
            resumo: "Metricas de tracao e sinais de interesse detectados pelo Autopilot.",
            dados: {
                "Total Prospectos": prospects,
                "Sequencias Ativas": sequences,
                "Mensagens Enviadas": messages,
                "Sinais de Crescimento": signals,
            },
            acoes: [
                "Escalar outbound para novos nichos.",
                "Responder sinais de alta prioridade.",
            ],
            atalhos: ["/today"],
        };
    },

    async renderPlaybook(orgId: string): Promise<PartialCommandResult> {
        const wonMeetings = await prisma.meetingPerformance.findMany({
            where: { organizationId: orgId, outcome: "won" },
            orderBy: { closedValue: "desc" },
            take: 10,
            select: { notes: true, closedValue: true },
        });

        const { MemoryEngine } = await import("./memory-engine");
        const savedPlaybooks = await MemoryEngine.searchMemories(orgId, undefined, ["playbook", "win_reason"], 5);

        const winPatterns = wonMeetings.map((meeting) => `Reuniao ganha - R$ ${(meeting.closedValue || 0) / 100}: ${(meeting.notes ?? "Sem notas").slice(0, 100)}`);

        return {
            title: "Top Playbooks de Conversao",
            resumo: wonMeetings.length > 0
                ? `Identificados ${wonMeetings.length} padroes de vitoria no seu pipeline.`
                : "Nenhuma reuniao ganha registrada ainda.",
            dados: {
                "Reunioes Ganhas": wonMeetings.length,
                "Valor Total (Won)": `R$ ${wonMeetings.reduce((sum, meeting) => sum + (meeting.closedValue || 0), 0) / 100}`,
                "Playbooks Salvos": savedPlaybooks.length,
                "Top Padroes": winPatterns.slice(0, 3),
            },
            acoes: savedPlaybooks.map((playbook) => playbook.text.slice(0, 120)),
            atalhos: ["/client", "/objections", "/pipeline"],
        };
    },

    async renderClient(orgId: string, args?: string): Promise<PartialCommandResult> {
        if (!args?.trim()) {
            return {
                title: "Client Lookup",
                resumo: "Use: /client <nome ou ID do lead>",
                dados: {},
                acoes: ["Exemplo: /client Aurora Tech"],
                atalhos: ["/pipeline"],
            };
        }

        const term = args.trim();
        const assessments = await prisma.assessment.findMany({
            where: {
                organizationId: orgId,
                OR: [
                    { name: { contains: term, mode: "insensitive" } },
                    { company: { contains: term, mode: "insensitive" } },
                    { id: term },
                ],
            },
            include: {
                proposals: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
            take: 3,
        });

        if (!assessments.length) {
            return {
                title: `Cliente: "${term}"`,
                resumo: "Nenhum cliente encontrado com esse nome ou ID.",
                dados: {},
                acoes: ["Verifique o nome e tente novamente."],
                atalhos: ["/pipeline"],
            };
        }

        const assessment = assessments[0];
        const latestProposal = assessment.proposals[0];

        return {
            title: `Cliente: ${assessment.company} (${assessment.name})`,
            resumo: `Historico completo do cliente ${assessment.company} - Score: ${assessment.classification || "-"}`,
            dados: {
                Lead: assessment.name,
                Empresa: assessment.company,
                Segmento: assessment.segment,
                Score: assessment.classification || "-",
                Status: assessment.status,
                "Criado em": assessment.createdAt.toLocaleDateString("pt-BR"),
                "Ultima Proposta": latestProposal
                    ? `Status: ${latestProposal.status} | ${latestProposal.createdAt.toLocaleDateString("pt-BR")}`
                    : "Nenhuma proposta",
                Dores: assessment.pains || "-",
            },
            acoes: [
                latestProposal?.status === "sent" ? "Follow-up pendente na proposta enviada." : "Criar nova proposta.",
                `Score ${assessment.classification} - ${assessment.classification === "hot" ? "Prioridade maxima." : "Monitorar."}`,
            ],
            atalhos: ["/playbook", "/pipeline"],
        };
    },

    async renderObjections(orgId: string): Promise<PartialCommandResult> {
        const { MemoryEngine } = await import("./memory-engine");
        const objections = await MemoryEngine.searchMemories(orgId, undefined, ["objection"], 10);
        const wonMeetings = await prisma.meetingPerformance.findMany({
            where: { organizationId: orgId, outcome: "won" },
            orderBy: { closedValue: "desc" },
            take: 5,
            select: { closedValue: true },
        });

        const topObjections = objections.slice(0, 5).map((objection, index) => ({
            [`Objecao ${index + 1}`]: objection.text.slice(0, 120),
            Confianca: `${objection.confidence}/10`,
        }));

        return {
            title: "Top Objecoes & Respostas Vencedoras",
            resumo: objections.length > 0
                ? `${objections.length} objecoes catalogadas. Reunioes ganhas: ${wonMeetings.length}.`
                : "Nenhuma objecao catalogada ainda.",
            dados: Object.assign({}, ...topObjections, {
                "Meetings Won (contexto)": wonMeetings.length,
                "Ticket Medio Won": wonMeetings.length > 0
                    ? `R$ ${wonMeetings.reduce((sum, meeting) => sum + (meeting.closedValue || 0), 0) / wonMeetings.length / 100}`
                    : "-",
            }),
            acoes: objections.length > 0
                ? objections.slice(0, 3).map((objection) => objection.text.slice(0, 80))
                : ["Registre objecoes para melhorar os playbooks de vendas."],
            atalhos: ["/playbook", "/test-strategy"],
        };
    },

    async renderTestStrategy(orgId: string, args?: string): Promise<PartialCommandResult> {
        if (!args?.trim()) {
            return {
                title: "Test Strategy",
                resumo: "Use: /test-strategy <mensagem de follow-up ou pitch>",
                dados: {},
                acoes: ["Exemplo: /test-strategy Oi Joao, passando para ver se teve chance de ver a proposta..."],
                atalhos: ["/playbook", "/objections"],
            };
        }

        const { buildRagContext } = await import("@/lib/memory/rag-context");
        const rag = await buildRagContext(orgId, args);
        const tone = detectTone(args);
        const cta = detectCTA(args);
        const riskFlags: string[] = [];

        if (args.toLowerCase().includes("so queria")) riskFlags.push("Tom passivo - evite 'so queria'");
        if (args.length > 300) riskFlags.push("Mensagem longa - considere resumir");
        if (!cta) riskFlags.push("Sem CTA claro - adicione um proximo passo");
        if (args.toLowerCase().includes("qualquer duvida")) riskFlags.push("CTA fraco - 'qualquer duvida' nao compromete");

        const suggestions = [
            riskFlags[0] ?? "Mensagem com bom equilibrio.",
            rag.chunkCount > 0 ? `${rag.chunkCount} evidencias internas encontradas.` : "Adicione evidencias de cases similares.",
            cta ? `CTA detectado: "${cta}"` : "Sugestao: termine com 'Conseguimos agendar 15min ainda essa semana?'",
        ];

        return {
            title: "Analise de Estrategia de Mensagem",
            resumo: `Analisando: "${args.slice(0, 60)}..."`,
            dados: {
                Tom: tone,
                "CTA Detectado": cta || "Nenhum",
                Riscos: riskFlags.length,
                "Evidencias Internas": rag.chunkCount,
                "Pontuacao Estimada": riskFlags.length === 0 ? "8/10" : riskFlags.length === 1 ? "5/10" : "3/10",
            },
            acoes: suggestions,
            atalhos: ["/objections", "/playbook"],
        };
    },

    renderHelp(): PartialCommandResult {
        return {
            title: "Control Room Help",
            resumo: "Lista de comandos disponiveis.",
            dados: {
                "/pipeline": "Resumo do funil comercial.",
                "/leaks": "Deteccao de perdas financeiras.",
                "/today": "Agenda e acoes do dia.",
                "/revenue": "Performance financeira e ROI.",
                "/team": "Ranking do time e faturamento.",
                "/rep <nome>": "Detalhes de performance por vendedor.",
                "/sla": "Leads parados por responsavel.",
                "/playbook": "Top playbooks que mais convertem.",
                "/client <nome>": "Historico e status de um cliente.",
                "/objections": "Top objecoes + respostas.",
                "/test-strategy": "Analise de pitch/follow-up.",
            },
            acoes: ["Experimente digitar /client <nome do seu lead principal>."],
            atalhos: ["/pipeline", "/leaks", "/today", "/revenue", "/team", "/sla"],
        };
    },

    async renderTeam(orgId: string): Promise<PartialCommandResult> {
        const { getLeaderboard } = await import("@/lib/sales/stats-engine");
        const { scanSLABreaches } = await import("@/lib/sales/sla-engine");
        const month = new Date().toISOString().slice(0, 7);
        const [leaderboard, breaches] = await Promise.all([
            getLeaderboard(orgId, month),
            scanSLABreaches(orgId, 48),
        ]);

        const topReps = leaderboard.slice(0, 3).map((rep) => `${rep.rank}. ${rep.name} (R$ ${rep.totalRevenueCents / 100})`);
        const atRiskReps = Array.from(new Set(breaches.map((breach) => breach.repName))).slice(0, 2);

        return {
            title: "Sales Team Leaderboard",
            resumo: `Faturamento Total: R$ ${leaderboard.reduce((sum, rep) => sum + rep.totalRevenueCents, 0) / 100}.`,
            dados: {
                Ranking: topReps.join(", "),
                "SLA Breaches": breaches.length,
                "Reps em Risco": atRiskReps.join(", ") || "Nenhum",
            },
            acoes: [
                breaches.length > 0 ? `${breaches.length} leads parados. Digite /sla para detalhes.` : "SLA em dia.",
                "Parabenizar top closers pelo faturamento.",
            ],
            atalhos: ["/leaderboard", "/sla", "/revenue"],
        };
    },

    async renderRep(orgId: string, args?: string): Promise<PartialCommandResult> {
        if (!args?.trim()) {
            return {
                title: "Rep Detail",
                resumo: "Use: /rep <nome>",
                dados: {},
                acoes: ["Exemplo: /rep Ricardo"],
                atalhos: ["/team"],
            };
        }

        const term = args.trim();
        const rep = await prisma.salesRep.findFirst({
            where: {
                organizationId: orgId,
                name: { contains: term, mode: "insensitive" },
            },
        });

        if (!rep) {
            return {
                title: "Rep not found",
                resumo: `Nenhum vendedor encontrado com o nome "${term}".`,
                dados: {},
                acoes: ["Verifique o nome no dashboard."],
                atalhos: ["/team"],
            };
        }

        const { getRepStats } = await import("@/lib/sales/stats-engine");
        const stats = await getRepStats(rep.id, new Date().toISOString().slice(0, 7));
        if (!stats) {
            return {
                title: "No stats",
                resumo: "Erro ao buscar estatisticas.",
                dados: {},
                acoes: [],
                atalhos: [],
            };
        }

        return {
            title: `Performance: ${rep.name}`,
            resumo: `Perfil de ${rep.role} - Win-rate: ${stats.winRate}%`,
            dados: {
                "Revenue (Mes)": `R$ ${stats.totalRevenueCents / 100}`,
                Meta: `${stats.targetPct}%`,
                "Leads Ativos": stats.totalLeads,
                "Avg Ticket": `R$ ${stats.avgTicketCents / 100}`,
                "Tempo p/ Fechar": `${stats.avgDaysToClose} dias`,
            },
            acoes: [
                stats.targetPct < 50 ? "Rep abaixo de 50% da meta. Oferecer suporte." : "Excelente performance.",
                "Ver detalhes no Dashboard de Vendas.",
            ],
            atalhos: ["/team", "/sla"],
        };
    },

    async renderAssign(): Promise<PartialCommandResult> {
        return {
            title: "Atribuicao de Leads",
            resumo: "Comando executivo bloqueado no WhatsApp.",
            dados: {
                Instrucao: "Para atribuir leads, use o Dashboard de Vendas ou o Admin Lead Detail.",
            },
            acoes: ["Acesse /admin/[id] para atribuir manualmente."],
            atalhos: ["/team", "/pipeline"],
        };
    },

    async renderSLA(orgId: string): Promise<PartialCommandResult> {
        const { groupBreachesByRep, scanSLABreaches } = await import("@/lib/sales/sla-engine");
        const breaches = await scanSLABreaches(orgId, 48);
        const grouped = groupBreachesByRep(breaches);
        const summary = grouped.slice(0, 3).map((group) => `${group.rep.name}: ${group.breaches.length} leads`);

        return {
            title: "SLA Risk Queue",
            resumo: breaches.length > 0
                ? `Existem ${breaches.length} leads quentes ou mornos sem follow-up a mais de 48h.`
                : "Nenhuma quebra de SLA detectada.",
            dados: {
                "Total de Riscos": breaches.length,
                "Top Reps em Falta": summary.join(", ") || "Nenhum",
            },
            acoes: breaches.length > 0
                ? [`Notificar ${breaches[0].repName} sobre o lead ${breaches[0].company}.`]
                : ["Continue monitorando a saude do pipeline."],
            atalhos: ["/team", "/today"],
        };
    },

    async renderStrategy(orgId: string): Promise<PartialCommandResult> {
        const { runStrategyAnalysis } = await import("../strategy/strategy-engine");
        const analysis = await runStrategyAnalysis(orgId);

        return {
            title: "Executive Strategy Insights",
            resumo: `Analise de 30 dias: ${analysis.recommendations.length} recomendacoes criticas para crescimento.`,
            dados: {
                Conversao: `${analysis.kpis.proposalAcceptanceRate.toFixed(1)}%`,
                "Show-Rate": `${analysis.kpis.meetingShowRate.toFixed(1)}%`,
                Gargalos: analysis.bottlenecks.length,
                "Top Reco": analysis.recommendations[0]?.title || "Nenhuma detectada",
            },
            acoes: analysis.recommendations.slice(0, 3).map((recommendation) => `${recommendation.title}: ${recommendation.summary.slice(0, 60)}...`),
            atalhos: ["/experiment", "/pipeline", "/revenue"],
        };
    },

    async renderExperiment(orgId: string): Promise<PartialCommandResult> {
        const { runStrategyAnalysis } = await import("../strategy/strategy-engine");
        const { buildExperimentDrafts } = await import("../strategy/experiments");
        const analysis = await runStrategyAnalysis(orgId);
        const topBottleneck = analysis.bottlenecks[0];
        const drafts = topBottleneck ? buildExperimentDrafts(topBottleneck.type) : [];

        return {
            title: "Growth Experiments (Drafts)",
            resumo: topBottleneck
                ? `Sugestoes para resolver gargalo de: ${topBottleneck.type}`
                : "Seu funil parece saudavel. Abaixo, sugestoes gerais de otimizacao.",
            dados: Object.fromEntries(drafts.slice(0, 3).map((draft) => [draft.metricKey, draft.hypothesis])),
            acoes: drafts.slice(0, 3).map((draft) => `ICE Score ${draft.score.toFixed(1)}: ${draft.hypothesis.slice(0, 50)}`),
            atalhos: ["/strategy", "/focus"],
        };
    },

    async renderFocus(orgId: string, args?: string): Promise<PartialCommandResult> {
        if (!args) {
            return {
                title: "Strategy Focus",
                resumo: "Use: /focus <industry|offer|channel>",
                dados: {},
                acoes: [],
                atalhos: [],
            };
        }

        await prisma.systemSetting.upsert({
            where: { key_organizationId: { key: "strategy_focus", organizationId: orgId } },
            create: { key: "strategy_focus", organizationId: orgId, value: args },
            update: { value: args },
        });

        return {
            title: "Focus Updated",
            resumo: `Foco estrategico definido para: ${args}.`,
            dados: { "Novo Foco": args },
            acoes: ["A engine de recomendacoes agora priorizara esse pilar."],
            atalhos: ["/strategy"],
        };
    },

    async renderRun(orgId: string, userId: string, args?: string): Promise<PartialCommandResult> {
        if (!args) {
            return {
                title: "Run Playbook",
                resumo: "Use: /run <pb_name>",
                dados: {},
                acoes: [],
                atalhos: [],
            };
        }

        const playbookId = args.trim();
        const job = await prisma.actionQueue.create({
            data: {
                organizationId: orgId,
                type: "playbook_run",
                priority: "high",
                payloadJson: JSON.stringify({ playbookId, actorUserId: userId, dryRun: false }),
            },
        });

        return {
            title: "Playbook Engine",
            resumo: `Iniciando execucao do playbook: ${playbookId}`,
            dados: { "Queue ID": job.id, Status: "Queued" },
            acoes: ["Acompanhe o andamento no Execution Center."],
            atalhos: ["/playbook"],
        };
    },
};

function detectTone(text: string): string {
    const lower = text.toLowerCase();
    if (lower.includes("urgente") || lower.includes("ultimo")) return "Urgencia/pressao";
    if (lower.includes("empolgad") || lower.includes("animad")) return "Entusiasta";
    if (lower.includes("so queria") || lower.includes("apenas")) return "Passivo";
    if (lower.includes("oportunidade") || lower.includes("resultado")) return "Orientado a valor";
    return "Neutro";
}

function detectCTA(text: string): string | null {
    const patterns = [
        /pode(mos)? (agendar|marcar|conversar)/i,
        /que tal (uma|um) (reuniao|call|conversa)/i,
        /disponivel (essa|esta) semana/i,
        /me diz (um horario|quando)/i,
        /link (para agendar|de agenda)/i,
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[0];
    }

    return null;
}
