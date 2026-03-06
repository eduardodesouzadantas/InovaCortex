export const HELP_CONTENT = {
    meetingShowRate: {
        title: "Meeting Show Rate",
        description: "Percentual de reuniões agendadas que realmente aconteceram.",
        benchmark: "Operações high-ticket saudáveis mantêm 70–85%.",
        actions: [
            "Confirmar reunião 24h antes",
            "Enviar agenda da call",
            "Filtrar leads frios"
        ]
    },
    proposalAcceptance: {
        title: "Proposal Acceptance Rate",
        description: "Percentual de propostas enviadas que foram aceitas pelo cliente.",
        benchmark: "30–50% para vendas consultivas high-ticket.",
        actions: [
            "Melhorar diagnóstico inicial",
            "Ajustar proposta ao ROI do cliente",
            "Fazer follow-up em até 48h"
        ]
    },
    profitLeaks: {
        title: "Profit Leaks",
        description: "Receita potencial perdida devido a follow-ups não feitos ou gargalos operacionais.",
        benchmark: "Empresas maduras mantêm leaks abaixo de 5% do pipeline.",
        actions: [
            "Responder propostas visualizadas",
            "Automatizar follow-ups",
            "Monitorar leads quentes"
        ]
    },
    replyTime: {
        title: "Reply Time",
        description: "Tempo médio de resposta às mensagens de clientes.",
        benchmark: "Menos de 10 minutos para operações high-ticket.",
        actions: [
            "Ativar alertas de SLA",
            "Automatizar respostas iniciais",
            "Distribuir conversas entre vendedores"
        ]
    },
    revenue: {
        title: "Receita Acumulada",
        description: "O total de receita fechada (Closed Won) dentro do período selecionado.",
        benchmark: "Depende da meta mensal estabelecida pelo CEO.",
        actions: [
            "Revisar 'Profit Leaks' para resgatar receita parada",
            "Injetar novos leads na cadência",
            "Fazer upsell na base de clientes ativos"
        ]
    },
    pipeline: {
        title: "Pipeline Value",
        description: "Valor total projetado ou ponderado das propostas abertas e em negociação.",
        benchmark: "O topo de funil deve cobrir 3x a 4x a sua meta de receita.",
        actions: [
            "Focar nas propostas quentes primeiro",
            "Eliminar deals estagnados há mais de 30 dias",
            "Qualificar melhor nas primeiras etapas"
        ]
    },
    strategyScore: {
        title: "Strategy Score (Health)",
        description: "Nota termômetro geral da organização, baseada no cumprimento de metas, saúde do funil e velocidade de fechamentos.",
        benchmark: "Scores acima de 80 são considerados operação blindada e ultra rentável.",
        actions: [
            "Resolver alertas Críticos de SLA com prioridade de CEO",
            "Zerar o Inbox diário de tarefas executivas",
            "Bater ou superar OMTMs semanais (One Metric That Matters)"
        ]
    },
    salesScore: {
        title: "Sales Score",
        description: "Pontuação composta de performance do vendedor, considerando conversão, revenue e respeito ao SLA.",
        benchmark: "Top performers mantêm score > 80 pts.",
        actions: [
            "Reduzir tempo de resposta para não perder pontos de SLA",
            "Focar em leads de maior ticket (Deal Size)",
            "Aumentar volume de reuniões concluídas (Show Rate)"
        ]
    },
    impactScore: {
        title: "Impact Score",
        description: "Potencial de retorno financeiro e estratégico de uma iniciativa ou insight.",
        benchmark: "Iniciativas com Impacto 8+ devem ser priorizadas pelo CEO.",
        actions: [
            "Avaliar o Effort Score em conjunto",
            "Dedicar recursos aos top 20% de impacto",
            "Validar a premissa de receita"
        ]
    },
    effortScore: {
        title: "Effort Score",
        description: "Nível de complexidade, tempo e custo necessários para implementar uma iniciativa.",
        benchmark: "O ideal são Quick Wins (Alto Impacto, Baixo Esforço < 4).",
        actions: [
            "Quebrar iniciativas grandes em fases menores",
            "Testar com protótipos de baixo custo",
            "Descartar projetos de Alto Esforço e Baixo Impacto"
        ]
    },
    benchmarkDelta: {
        title: "Benchmark Delta",
        description: "Diferença entre o seu KPI atual e a média das empresas do mesmo segmento na InovaCortex.",
        benchmark: "Valores positivos indicam liderança de mercado. Negativos exigem atenção.",
        actions: [
            "Analisar leaks operacionais",
            "Injetar mais eficiência nas etapas críticas do funil",
            "Acompanhar evolução mensal do Delta"
        ]
    },
    sla: {
        title: "SLA (Service Level Agreement)",
        description: "Tempo máximo permitido para responder um cliente de acordo com a prioridade dele na fila.",
        benchmark: "Leads Quentes: < 5 min. Clientes Ativos: < 15 min.",
        actions: [
            "Priorizar mensagens com SLA Crítico na Inbox",
            "Usar Quick Replies para triagem imediata",
            "Transferir tickets ociosos para outro vendedor"
        ]
    },
    campaignPerformance: {
        title: "Campaign Performance",
        description: "Métricas de disparo em massa no WhatsApp: Entrega, Leitura e Resposta.",
        benchmark: "Taxa de abertura aceitável > 70%. Taxa de resposta > 15%.",
        actions: [
            "Otimizar copywriting da primeira mensagem",
            "Segmentar melhor a lista de envio inicial",
            "Monitorar bloqueios e saúde do número"
        ]
    },
    conversationStatus: {
        title: "Conversation Status",
        description: "Estado do ticket na fila de atendimento. Aberto (Aguardando resposta), Respondido ou Fechado.",
        benchmark: "Manter o Inbox Zero (0 conversas em Aberto no fim do dia).",
        actions: [
            "Resolver pendências de clientes",
            "Anotar Insights no CRM ao fechar ticket",
            "Agendar follow-up automático para leads mornos"
        ]
    }
};

export type HelpTopic = keyof typeof HELP_CONTENT;
