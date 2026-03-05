/**
 * lib/provisioning-templates.ts
 * V12: Pure data module — task and checklist templates.
 * No Prisma dependency so it can be imported in unit tests.
 */

export interface TaskTemplate {
    title: string;
    description: string;
    ownerRole: "owner" | "admin" | "closer";
    phase: "setup" | "development" | "launch" | "handoff";
    dueDaysFromNow: number;
    orderIndex: number;
}

export interface ChecklistTemplate {
    system: string;
    item: string;
}

// ─── Base Tasks (all workspaces) ──────────────────────────────────────────────

export const BASE_TASKS: TaskTemplate[] = [
    { title: "Kickoff Meeting", description: "Reunião inicial com o cliente para apresentar o plano, validar escopo e alinhar expectativas.", ownerRole: "admin", phase: "setup", dueDaysFromNow: 3, orderIndex: 1 },
    { title: "Mapear stakeholders e acessos", description: "Identificar responsáveis técnicos do cliente e solicitar credenciais de sistemas.", ownerRole: "closer", phase: "setup", dueDaysFromNow: 5, orderIndex: 2 },
    { title: "Configurar ambiente de desenvolvimento", description: "Criar workspace no Make/Zapier, configurar variáveis de ambiente e acessos ao servidor.", ownerRole: "admin", phase: "setup", dueDaysFromNow: 7, orderIndex: 3 },
    { title: "Validar integrações do checklist", description: "Confirmar que todos os tokens e webhooks do checklist estão ativos e funcionando.", ownerRole: "admin", phase: "development", dueDaysFromNow: 14, orderIndex: 10 },
    { title: "Testes de homologação", description: "Executar fluxo completo em ambiente de teste, documentar resultados e obter aprovação.", ownerRole: "admin", phase: "development", dueDaysFromNow: 21, orderIndex: 11 },
    { title: "Treinamento do time do cliente", description: "Apresentar o Mission Control, dashboards e como monitorar os agentes.", ownerRole: "closer", phase: "launch", dueDaysFromNow: 28, orderIndex: 20 },
    { title: "Go-Live supervisionado", description: "Ativar agentes em produção com monitoramento em tempo real por 48h.", ownerRole: "admin", phase: "launch", dueDaysFromNow: 30, orderIndex: 21 },
    { title: "Relatório de entrega (Handoff)", description: "Documentar o que foi entregue, métricas iniciais e próximos passos do cliente.", ownerRole: "owner", phase: "handoff", dueDaysFromNow: 35, orderIndex: 30 },
];

// ─── Module-specific Tasks ────────────────────────────────────────────────────

export const MODULE_TASKS: Record<string, TaskTemplate[]> = {
    "whatsapp-agent": [
        { title: "Configurar número WhatsApp Business", description: "Criar conta Meta Business, gerar token permanente e configurar webhook.", ownerRole: "admin", phase: "setup", dueDaysFromNow: 6, orderIndex: 4 },
        { title: "Criar fluxo conversacional", description: "Mapear árvore de decisão, boas-vindas, FAQs e escalação humana.", ownerRole: "admin", phase: "development", dueDaysFromNow: 12, orderIndex: 5 },
        { title: "Testar jornada completa no WhatsApp", description: "Validar envio, recebimento, botões de resposta e tempo de resposta do agente.", ownerRole: "admin", phase: "development", dueDaysFromNow: 18, orderIndex: 12 },
    ],
    "instagram-agent": [
        { title: "Conectar conta Instagram Business", description: "Vincular via Meta Developer, obter page_id e access_token.", ownerRole: "admin", phase: "setup", dueDaysFromNow: 6, orderIndex: 4 },
        { title: "Configurar respostas para DMs e comentários", description: "Criar templates de resposta para DirectMessages e comentários estratégicos.", ownerRole: "closer", phase: "development", dueDaysFromNow: 13, orderIndex: 6 },
    ],
    "crm-integration": [
        { title: "Mapear campos CRM ↔ Assessment", description: "Identificar campos do CRM que recebem dados do formulário de avaliação.", ownerRole: "admin", phase: "setup", dueDaysFromNow: 7, orderIndex: 4 },
        { title: "Configurar sincronização bidirecional", description: "Criar fluxo Make/Zapier para criar/atualizar leads no CRM automaticamente.", ownerRole: "admin", phase: "development", dueDaysFromNow: 15, orderIndex: 7 },
    ],
    "erp-integration": [
        { title: "Mapear dados ERP para automação", description: "Identificar entidades (pedidos, estoque, clientes) relevantes para automação.", ownerRole: "admin", phase: "setup", dueDaysFromNow: 8, orderIndex: 4 },
        { title: "Criar endpoints de sincronização ERP", description: "Desenvolver webhooks ou polling para manter ERP e plataforma sincronizados.", ownerRole: "admin", phase: "development", dueDaysFromNow: 17, orderIndex: 8 },
    ],
    "ai-support": [
        { title: "Treinar base de conhecimento do agente", description: "Carregar FAQs, políticas e documentação do cliente no vetor de embeddings.", ownerRole: "admin", phase: "development", dueDaysFromNow: 10, orderIndex: 5 },
        { title: "Calibrar prompts e tom de voz", description: "Ajustar tom, persona e regras de escalação do agente de suporte IA.", ownerRole: "closer", phase: "development", dueDaysFromNow: 14, orderIndex: 9 },
    ],
    "make-automation": [
        { title: "Criar cenários Make principais", description: "Implementar cenários de automação no Make conforme fluxo mapeado.", ownerRole: "admin", phase: "development", dueDaysFromNow: 11, orderIndex: 6 },
        { title: "Testar automações Make em staging", description: "Validar todos os cenários Make com dados reais de teste.", ownerRole: "admin", phase: "development", dueDaysFromNow: 19, orderIndex: 13 },
    ],
};

// ─── Base Checklist (all workspaces) ─────────────────────────────────────────

export const BASE_CHECKLIST: ChecklistTemplate[] = [
    { system: "Geral", item: "NDA / Contrato assinado" },
    { system: "Geral", item: "Acesso ao repositório / workspace entregue" },
    { system: "Geral", item: "Canal de comunicação (Slack/WhatsApp) criado" },
];

// ─── Module Checklist ─────────────────────────────────────────────────────────

export const MODULE_CHECKLIST: Record<string, ChecklistTemplate[]> = {
    "whatsapp-agent": [
        { system: "WhatsApp", item: "Número aprovado pelo Meta Business" },
        { system: "WhatsApp", item: "Token permanente gerado" },
        { system: "WhatsApp", item: "Webhook URL configurado e verificado" },
        { system: "WhatsApp", item: "Número de teste validado pelo cliente" },
    ],
    "instagram-agent": [
        { system: "Instagram", item: "Conta Business conectada ao Meta Developer" },
        { system: "Instagram", item: "Access token de longa duração gerado" },
        { system: "Instagram", item: "Permissões: messages, comments concedidas" },
    ],
    "crm-integration": [
        { system: "CRM", item: "API key / credenciais do CRM fornecidas" },
        { system: "CRM", item: "Webhook de entrada configurado no CRM" },
        { system: "CRM", item: "Campos customizados criados no CRM" },
    ],
    "erp-integration": [
        { system: "ERP", item: "Usuário de integração ERP criado" },
        { system: "ERP", item: "Módulos liberados para API" },
        { system: "ERP", item: "Ambiente de sandbox ERP disponibilizado" },
    ],
    "make-automation": [
        { system: "Make", item: "Conta Make criada e plano definido" },
        { system: "Make", item: "Workspace de produção criado" },
        { system: "Make", item: "Conexões OAuth aprovadas" },
    ],
    "ai-support": [
        { system: "OpenAI/AI", item: "API key da OpenAI fornecida" },
        { system: "OpenAI/AI", item: "Cota de uso e billing configurados" },
        { system: "OpenAI/AI", item: "Documentação base do cliente entregue" },
    ],
};
