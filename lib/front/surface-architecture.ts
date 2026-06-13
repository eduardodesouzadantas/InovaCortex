export type SurfaceKind = "agency" | "operator" | "ceo";

export type SurfaceIconKey =
    | "activity"
    | "bar-chart"
    | "briefcase"
    | "building"
    | "brain"
    | "command"
    | "file"
    | "message"
    | "radar"
    | "settings"
    | "shield"
    | "sparkles"
    | "users";

export interface SurfaceNavItem {
    href: string;
    label: string;
    description: string;
    icon: SurfaceIconKey;
    badge?: string;
}

export interface SurfaceNavSection {
    id: string;
    label: string;
    description: string;
    items: SurfaceNavItem[];
}

export interface SurfaceDefinition {
    kind: SurfaceKind;
    label: string;
    title: string;
    description: string;
    sections: SurfaceNavSection[];
    crossLinks: SurfaceNavItem[];
}

export function buildAgencySurfaceDefinition(): SurfaceDefinition {
    return {
        kind: "agency",
        label: "Agency Surface",
        title: "Control plane and agency operating system",
        description: "A agency governa a plataforma e opera o proprio negocio no mesmo namespace, sem cair em semantica de admin generico.",
        sections: [
            {
                id: "agency-ops",
                label: "Agency Operating System",
                description: "Operacao comercial, CRM, agenda, marketing, conteudo e execucao da propria agencia.",
                items: [
                    {
                        href: "/agency/dashboard",
                        label: "Agency Home",
                        description: "Entrada operacional da agencia como negocio.",
                        icon: "building",
                    },
                    {
                        href: "/agency/commercial/leads",
                        label: "Commercial CRM",
                        description: "Pipeline, leads e follow-up da agencia.",
                        icon: "briefcase",
                    },
                    {
                        href: "/agency/commercial/workspaces",
                        label: "Client Delivery",
                        description: "Workspaces e operacao dos clientes em implantacao.",
                        icon: "users",
                    },
                    {
                        href: "/agency/whatsapp",
                        label: "Agency Inbox",
                        description: "Canal conversacional da propria agencia.",
                        icon: "message",
                    },
                    {
                        href: "/agency/content",
                        label: "Content Engine",
                        description: "Conteudo, publishing e growth da agencia.",
                        icon: "file",
                    },
                    {
                        href: "/agency/authority",
                        label: "Authority Library",
                        description: "Prova de valor e ativos de autoridade.",
                        icon: "sparkles",
                    },
                    {
                        href: "/agency/builder",
                        label: "Builder",
                        description: "Playbooks e artefatos operacionais da agencia.",
                        icon: "brain",
                    },
                ],
            },
            {
                id: "agency-control",
                label: "Platform Control",
                description: "Governanca, rollout, saude da plataforma, integracoes, observabilidade e prova de valor.",
                items: [
                    {
                        href: "/agency/cockpit",
                        label: "Agency Cockpit",
                        description: "War room da plataforma e da operacao interna.",
                        icon: "activity",
                    },
                    {
                        href: "/agency/executive",
                        label: "Executive Intelligence",
                        description: "Leitura executiva da agencia e da carteira.",
                        icon: "bar-chart",
                    },
                    {
                        href: "/agency/command-center",
                        label: "Command Center",
                        description: "Automacoes, jobs e comandos de operacao.",
                        icon: "command",
                    },
                    {
                        href: "/agency/monitoring",
                        label: "Monitoring",
                        description: "Health, observabilidade e risco operacional.",
                        icon: "shield",
                    },
                    {
                        href: "/agency/costs",
                        label: "Costs",
                        description: "Uso, custo e eficiencia da maquina.",
                        icon: "radar",
                    },
                    {
                        href: "/agency/settings",
                        label: "Settings",
                        description: "Integracoes, parametros e governanca.",
                        icon: "settings",
                    },
                    {
                        href: "/agency/organizations",
                        label: "Organizations",
                        description: "Visibilidade e leitura das empresas da plataforma.",
                        icon: "building",
                    },
                ],
            },
        ],
        crossLinks: [
            {
                href: "/agency/executive-pack",
                label: "Executive Pack",
                description: "Material executivo e prova de valor.",
                icon: "file",
            },
        ],
    };
}

export function buildTenantOperatorSurfaceDefinition(input: {
    slug: string;
    canAccessExecutive: boolean;
}): SurfaceDefinition {
    const { slug, canAccessExecutive } = input;

    return {
        kind: "operator",
        label: "Tenant Operator Surface",
        title: "Cockpit operacional de execucao",
        description: "Superficie de rotina para agir no dia: CRM, inbox, follow-up, agenda, fila operacional e crescimento do tenant sem semantica executiva.",
        sections: [
            {
                id: "operator-core",
                label: "Operate",
                description: "Execucao diaria do tenant com foco em agora, atrasos e proximo passo.",
                items: [
                    {
                        href: `/org/${slug}/admin`,
                        label: "Mission Control",
                        description: "Pipeline principal e rotina de operacao.",
                        icon: "briefcase",
                    },
                    {
                        href: `/org/${slug}/admin/crm`,
                        label: "CRM Workspace",
                        description: "Table, board e ficha 360 do fluxo comercial canonico.",
                        icon: "users",
                    },
                    {
                        href: `/org/${slug}/admin/cockpit`,
                        label: "War Room",
                        description: "Cockpit operacional e sinais urgentes.",
                        icon: "activity",
                    },
                    {
                        href: `/org/${slug}/admin/whatsapp`,
                        label: "WhatsApp CRM",
                        description: "Inbox, conversas e execucao comercial.",
                        icon: "message",
                    },
                    {
                        href: `/org/${slug}/admin/deals`,
                        label: "Deals",
                        description: "Oportunidades, propostas e pipeline.",
                        icon: "bar-chart",
                    },
                    {
                        href: `/org/${slug}/admin/workspaces`,
                        label: "Execution",
                        description: "Tarefas, entrega e trilha operacional.",
                        icon: "users",
                    },
                ],
            },
            {
                id: "operator-growth",
                label: "Grow",
                description: "Motores de crescimento e ativacao usados como rotina operacional.",
                items: [
                    {
                        href: `/org/${slug}/admin/offers`,
                        label: "Offers",
                        description: "Ofertas, studio e empacotamento comercial.",
                        icon: "sparkles",
                    },
                    {
                        href: `/org/${slug}/admin/outbound`,
                        label: "Outbound",
                        description: "Sequencias, prospeccao e follow-up.",
                        icon: "radar",
                    },
                    {
                        href: `/org/${slug}/admin/content`,
                        label: "Content",
                        description: "Conteudo e publishing da operacao.",
                        icon: "file",
                    },
                    {
                        href: `/org/${slug}/admin/marketing`,
                        label: "Marketing",
                        description: "Calendario e reaproveitamento de ativos.",
                        icon: "building",
                    },
                    {
                        href: `/org/${slug}/admin/ai`,
                        label: "AI Room",
                        description: "Copilot e execucao com IA.",
                        icon: "brain",
                    },
                ],
            },
            {
                id: "operator-system",
                label: "System",
                description: "Coordenacao da maquina, configuracao e fila sistêmica do tenant.",
                items: [
                    {
                        href: `/org/${slug}/admin/command-center`,
                        label: "Command Center",
                        description: "Comandos, jobs e coordenacao da maquina.",
                        icon: "command",
                    },
                    {
                        href: `/org/${slug}/admin/performance`,
                        label: "Performance",
                        description: "Metricas de equipe e saude da operacao.",
                        icon: "bar-chart",
                    },
                    {
                        href: `/org/${slug}/admin/billing`,
                        label: "Billing",
                        description: "Plano, consumo e limites.",
                        icon: "shield",
                    },
                    {
                        href: `/org/${slug}/admin/configuracoes`,
                        label: "Settings",
                        description: "Integracoes, webhooks e parametros.",
                        icon: "settings",
                    },
                    {
                        href: `/org/${slug}/admin/webhooks`,
                        label: "Webhooks",
                        description: "Endpoints publicos, assinatura e entregas.",
                        icon: "shield",
                    },
                ],
            },
        ],
        crossLinks: canAccessExecutive
            ? [
                {
                    href: `/org/${slug}/executive`,
                    label: "CEO Surface",
                    description: "Leitura executiva do tenant.",
                    icon: "sparkles",
                    badge: "admin+",
                },
            ]
            : [],
    };
}

export function buildTenantExecutiveSurfaceDefinition(slug: string): SurfaceDefinition {
    return {
        kind: "ceo",
        label: "Tenant CEO Surface",
        title: "Superficie de comando",
        description: "Leitura executiva do tenant para risco, receita, gargalos e decisao. Nao substitui o cockpit operacional.",
        sections: [
            {
                id: "ceo-reading",
                label: "Executive Reading",
                description: "Leitura de receita, gargalos e prioridades.",
                items: [
                    {
                        href: `/org/${slug}/executive`,
                        label: "Overview",
                        description: "Resumo executivo principal do tenant.",
                        icon: "sparkles",
                    },
                    {
                        href: `/org/${slug}/executive#pipeline`,
                        label: "Revenue and Pipeline",
                        description: "Leitura de pipeline, conversao e proximidade de receita.",
                        icon: "bar-chart",
                    },
                    {
                        href: `/org/${slug}/executive#alerts`,
                        label: "Alerts and Risk",
                        description: "Alertas priorizados, vazamentos e gargalos.",
                        icon: "shield",
                    },
                    {
                        href: `/org/${slug}/executive#actions`,
                        label: "Executive Priorities",
                        description: "Prioridades que a lideranca deve destravar.",
                        icon: "radar",
                    },
                ],
            },
        ],
        crossLinks: [
            {
                href: `/org/${slug}/admin`,
                label: "Operator Surface",
                description: "Voltar para o cockpit de execucao.",
                icon: "activity",
            },
            {
                href: `/org/${slug}/admin/ai`,
                label: "AI Room",
                description: "Bridge com a operacao assistida por IA.",
                icon: "brain",
            },
        ],
    };
}
