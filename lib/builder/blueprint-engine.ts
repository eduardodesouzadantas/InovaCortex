/**
 * lib/builder/blueprint-engine.ts
 * V25.1: Blueprint Engine — 100% deterministic, no LLM, no secrets.
 *
 * Public API:
 *   buildInputSnapshot(orgId, opts)   → InputSnapshot  (sanitized DB snapshot)
 *   selectTemplates(snapshot)         → string[]        (template key list)
 *   compileBlueprint(templates, snap) → Blueprint        (canonical JSON)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type Tier = "hot" | "warm" | "cold";
export type Industry = "saas" | "clinic" | "ecommerce" | "service" | "education" | "other";
export type Mission = "Vendas" | "Suporte" | "Backoffice" | "Dados" | "Automação Operacional Básica";

export interface InputSnapshot {
    // Identity
    orgId: string;
    assessmentId: string | null;
    proposalId: string | null;
    workspaceId: string | null;
    snapshotAt: string;  // ISO

    // Lead / company context
    company: string;
    segment: string;
    industry: Industry;
    teamSize: string;
    volumeDay: string;

    // Scoring
    scoreTotal: number;
    tier: Tier;
    missions: Mission[];

    // Channels used
    channels: string[];
    hasWhatsApp: boolean;
    hasInstagram: boolean;
    hasLinkedIn: boolean;
    hasEmail: boolean;

    // Stack context
    hasCRM: boolean;
    hasERP: boolean;
    hasAutomation: boolean;
    hasAPI: boolean;

    // Urgency signal
    urgency: "high" | "medium" | "low";

    // Proposal data (if present)
    proposedModules: string[];
    estimatedBudget: "low" | "medium" | "high" | "unknown";
}

export interface BlueprintModule {
    key: string;   // e.g. "whatsapp_agent"
    label: string;
    enabled: boolean;
    priority: number;   // 1 (highest) – 5
    dependencies: string[]; // other module keys
}

export interface Integration {
    key: string;
    label: string;
    required: boolean;
    docs: string;
}

export interface AppRoute {
    path: string;
    label: string;
    role: "admin" | "user" | "public";
}

export interface TaskTemplate {
    phase: string;
    title: string;
    owner: "inovacortex" | "client";
    estimateDays: number;
}

export interface Setting {
    key: string;
    defaultValue: string;
    required: boolean;
    description: string;
}

export interface PreflightCheck {
    id: string;
    description: string;
    blocking: boolean;
}

export interface RolloutPhase {
    phase: number;
    name: string;
    duration: string;
    goals: string[];
    modules: string[];
}

export interface Blueprint {
    version: "1.0";
    generatedAt: string;  // ISO — stable within same second
    orgId: string;
    tier: Tier;

    selectedModules: BlueprintModule[];
    integrations: Integration[];
    routes: AppRoute[];
    taskTemplates: TaskTemplate[];
    settings: Setting[];
    preflightChecks: PreflightCheck[];
    rolloutPlan: RolloutPhase[];

    // Stable JSON fingerprint (sorted keys)
    _checksum: string;
}

// ─── Module catalog ───────────────────────────────────────────────────────────

const MODULE_CATALOG: Record<string, Omit<BlueprintModule, "enabled">> = {
    whatsapp_agent: { key: "whatsapp_agent", label: "Agente WhatsApp", priority: 1, dependencies: [] },
    instagram_agent: { key: "instagram_agent", label: "Agente Instagram", priority: 2, dependencies: [] },
    linkedin_outbound: { key: "linkedin_outbound", label: "Outbound LinkedIn", priority: 2, dependencies: [] },
    email_sequences: { key: "email_sequences", label: "Sequências de Email", priority: 3, dependencies: [] },
    crm_sync: { key: "crm_sync", label: "Sincronização CRM", priority: 2, dependencies: ["whatsapp_agent"] },
    erp_integration: { key: "erp_integration", label: "Integração ERP", priority: 3, dependencies: ["crm_sync"] },
    calendly_booking: { key: "calendly_booking", label: "Agendamento Calendly", priority: 2, dependencies: ["whatsapp_agent"] },
    google_calendar: { key: "google_calendar", label: "Google Calendar", priority: 3, dependencies: ["calendly_booking"] },
    proposal_engine: { key: "proposal_engine", label: "Motor de Propostas", priority: 1, dependencies: [] },
    assessment_form: { key: "assessment_form", label: "Formulário de Diagnóstico", priority: 1, dependencies: [] },
    ai_brain: { key: "ai_brain", label: "Cérebro IA (Orchestrator)", priority: 1, dependencies: [] },
    dashboard_cockpit: { key: "dashboard_cockpit", label: "Dashboard CEO", priority: 2, dependencies: ["ai_brain"] },
    profit_leak: { key: "profit_leak", label: "Profit Leak Detector", priority: 2, dependencies: ["dashboard_cockpit"] },
    outbound_sequences: { key: "outbound_sequences", label: "Sequências Outbound", priority: 2, dependencies: ["linkedin_outbound"] },
    support_agent: { key: "support_agent", label: "Agente de Suporte", priority: 2, dependencies: ["whatsapp_agent"] },
    backoffice_bot: { key: "backoffice_bot", label: "Bot Backoffice", priority: 3, dependencies: ["crm_sync"] },
    data_pipeline: { key: "data_pipeline", label: "Pipeline de Dados", priority: 3, dependencies: ["crm_sync"] },
    executive_pack: { key: "executive_pack", label: "Executive Pack Generator", priority: 4, dependencies: ["dashboard_cockpit", "profit_leak"] },
};

// ─── Integration catalog ──────────────────────────────────────────────────────

const INTEGRATION_CATALOG: Record<string, Integration> = {
    meta_whatsapp: { key: "meta_whatsapp", label: "Meta WhatsApp Business API", required: false, docs: "https://developers.facebook.com/docs/whatsapp" },
    calendly: { key: "calendly", label: "Calendly API", required: false, docs: "https://developer.calendly.com" },
    google_calendar: { key: "google_calendar", label: "Google Calendar API", required: false, docs: "https://developers.google.com/calendar" },
    linkedin_api: { key: "linkedin_api", label: "LinkedIn API (optional)", required: false, docs: "https://developer.linkedin.com" },
    instagram_graph: { key: "instagram_graph", label: "Instagram Graph API", required: false, docs: "https://developers.facebook.com/docs/instagram-api" },
    openai: { key: "openai", label: "OpenAI API", required: true, docs: "https://platform.openai.com/docs" },
    prisma_db: { key: "prisma_db", label: "Prisma / SQLite (or Postgres)", required: true, docs: "https://www.prisma.io/docs" },
};

// ─── Route catalog ────────────────────────────────────────────────────────────

const ALL_ROUTES: AppRoute[] = [
    { path: "/org/[slug]/admin", label: "Admin Home", role: "admin" },
    { path: "/org/[slug]/admin/command-center", label: "CEO Command Center", role: "admin" },
    { path: "/org/[slug]/admin/radar", label: "Business Radar", role: "admin" },
    { path: "/org/[slug]/admin/executive-pack", label: "Executive Pack", role: "admin" },
    { path: "/org/[slug]/admin/builder", label: "Builder Autopilot", role: "admin" },
    { path: "/org/[slug]/cockpit", label: "Cockpit", role: "user" },
    { path: "/org/[slug]/leads", label: "Leads", role: "user" },
    { path: "/org/[slug]/proposals", label: "Propostas", role: "user" },
    { path: "/avaliacao", label: "Formulário Avaliação", role: "public" },
    { path: "/diagnostico/[slug]", label: "Diagnóstico Público", role: "public" },
];

// ─── Template → module mapping ────────────────────────────────────────────────

const TEMPLATE_MODULE_MAP: Record<string, string[]> = {
    whatsapp_funnel_v1: ["whatsapp_agent", "calendly_booking", "proposal_engine", "ai_brain", "dashboard_cockpit"],
    clinic_stack_v1: ["whatsapp_agent", "calendly_booking", "google_calendar", "assessment_form", "proposal_engine", "ai_brain", "dashboard_cockpit", "support_agent"],
    outbound_saas_v1: ["linkedin_outbound", "outbound_sequences", "email_sequences", "crm_sync", "proposal_engine", "ai_brain", "dashboard_cockpit"],
    full_stack_v1: Object.keys(MODULE_CATALOG),
    lite_v1: ["whatsapp_agent", "assessment_form", "proposal_engine", "ai_brain"],
    ecommerce_v1: ["whatsapp_agent", "instagram_agent", "support_agent", "crm_sync", "ai_brain", "dashboard_cockpit"],
    data_heavy_v1: ["crm_sync", "erp_integration", "data_pipeline", "ai_brain", "dashboard_cockpit", "profit_leak"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function tierFromScore(score: number): Tier {
    if (score >= 70) return "hot";
    if (score >= 40) return "warm";
    return "cold";
}

function inferIndustry(segment: string): Industry {
    const s = segment.toLowerCase();
    if (s.includes("saas") || s.includes("software") || s.includes("tech")) return "saas";
    if (s.includes("clinic") || s.includes("saúde") || s.includes("médico") || s.includes("odonto")) return "clinic";
    if (s.includes("ecommerce") || s.includes("loja") || s.includes("varejo")) return "ecommerce";
    if (s.includes("educ") || s.includes("escola") || s.includes("curso")) return "education";
    return "service";
}

function inferUrgency(urgency: string): "high" | "medium" | "low" {
    const u = urgency.toLowerCase();
    if (u.includes("alta") || u.includes("imediato") || u.includes("urgente") || u.includes("ontem")) return "high";
    if (u.includes("média") || u.includes("proximo") || u.includes("médio")) return "medium";
    return "low";
}

function inferBudget(pricingEstimate?: any): "low" | "medium" | "high" | "unknown" {
    if (!pricingEstimate) return "unknown";
    try {
        const p = typeof pricingEstimate === "string" ? JSON.parse(pricingEstimate) : pricingEstimate;
        const mid = ((p.min ?? 0) + (p.max ?? 0)) / 2;
        if (mid >= 50_000) return "high";
        if (mid >= 15_000) return "medium";
        return "low";
    } catch { return "unknown"; }
}

/** Stable JSON — sorted keys, no secrets */
export function stableJson(obj: unknown): string {
    return JSON.stringify(obj, Object.keys(flattenKeys(obj as any)).sort());
}

function flattenKeys(obj: Record<string, unknown>, prefix = ""): Record<string, true> {
    let out: Record<string, true> = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
        const full = prefix ? `${prefix}.${k}` : k;
        out[full] = true;
        if (v && typeof v === "object" && !Array.isArray(v)) {
            out = { ...out, ...flattenKeys(v as any, full) };
        }
    }
    return out;
}

/** Simple checksum — non-crypto, deterministic fingerprint */
export function checksum(s: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
}

// ─── 1) buildInputSnapshot ────────────────────────────────────────────────────

export async function buildInputSnapshot(
    orgId: string,
    opts: { workspaceId?: string; proposalId?: string; assessmentId?: string } = {},
): Promise<InputSnapshot> {
    const { prisma } = await import("@/lib/prisma");
    const { calculateScore } = await import("@/lib/scoring");

    // Fetch related records in parallel
    const [assessment, proposal] = await Promise.all([
        opts.assessmentId
            ? (prisma as any).assessment.findUnique({
                where: { id: opts.assessmentId }, select: {
                    id: true, company: true, segment: true, scoreTotal: true,
                    channels: true, stack: true, pains: true, urgency: true,
                    goal: true, teamSize: true, volumeDay: true,
                }
            }).catch(() => null)
            : Promise.resolve(null),

        opts.proposalId
            ? (prisma as any).proposal.findUnique({
                where: { id: opts.proposalId }, select: {
                    id: true, pricingEstimate: true, selectedModules: true,
                }
            }).catch(() => null)
            : Promise.resolve(null),
    ]);

    // Fallback defaults
    const segment = assessment?.segment ?? "Outros";
    const urgency = assessment?.urgency ?? "baixa";
    const channels = parseJsonArray(assessment?.channels);
    const stack = parseJsonArray(assessment?.stack);
    const pains = parseJsonArray(assessment?.pains);

    // Re-calculate score for consistency (or use persisted)
    let scoreTotal = assessment?.scoreTotal ?? 30;
    if (assessment && !opts.assessmentId) {
        // Compute fresh if needed
        try {
            const r = calculateScore({
                name: "", email: "", company: assessment.company, role: "",
                segment, teamSize: assessment.teamSize ?? "-",
                volumeDay: assessment.volumeDay ?? "-",
                channels, stack, pains, urgency, goal: assessment.goal ?? "",
            });
            scoreTotal = r.scoreTotal;
        } catch { }
    }

    const tier = tierFromScore(scoreTotal);
    const missions = inferMissions(channels, stack, pains, assessment?.goal ?? "", scoreTotal);

    const cLow = channels.map(c => c.toLowerCase());
    const sLow = stack.map(s => s.toLowerCase());

    const proposedModules = parseJsonArray(proposal?.selectedModules);
    const budgetRaw = proposal?.pricingEstimate;

    return {
        orgId,
        assessmentId: opts.assessmentId ?? null,
        proposalId: opts.proposalId ?? null,
        workspaceId: opts.workspaceId ?? null,
        snapshotAt: new Date().toISOString(),

        company: assessment?.company ?? "Unknown",
        segment,
        industry: inferIndustry(segment),
        teamSize: assessment?.teamSize ?? "-",
        volumeDay: assessment?.volumeDay ?? "-",

        scoreTotal,
        tier,
        missions,

        channels,
        hasWhatsApp: cLow.some(c => c.includes("whatsapp")),
        hasInstagram: cLow.some(c => c.includes("instagram")),
        hasLinkedIn: cLow.some(c => c.includes("linkedin")),
        hasEmail: cLow.some(c => c.includes("email")),

        hasCRM: sLow.some(s => ["crm", "hubspot", "rd", "pipedrive", "salesforce"].some(k => s.includes(k))),
        hasERP: sLow.some(s => ["erp", "sap", "totvs", "bling", "omie"].some(k => s.includes(k))),
        hasAutomation: sLow.some(s => ["make", "zapier", "n8n"].some(k => s.includes(k))),
        hasAPI: sLow.some(s => s.includes("api")),

        urgency: inferUrgency(urgency),

        proposedModules,
        estimatedBudget: inferBudget(budgetRaw),
    };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function parseJsonArray(v: unknown): string[] {
    if (!v) return [];
    if (Array.isArray(v)) return v.map(String);
    try { const arr = JSON.parse(v as string); return Array.isArray(arr) ? arr.map(String) : []; }
    catch { return []; }
}

function inferMissions(
    channels: string[], stack: string[], pains: string[],
    goal: string, score: number,
): Mission[] {
    const ms = new Set<Mission>();
    const sLow = stack.map(s => s.toLowerCase());
    const cLow = channels.map(c => c.toLowerCase());
    const gLow = goal.toLowerCase();
    const hasCRM = sLow.some(s => ["crm", "hubspot", "rd", "pipedrive", "salesforce"].some(k => s.includes(k)));
    const hasERP = sLow.some(s => ["erp", "sap", "totvs", "bling", "omie"].some(k => s.includes(k)));
    const hasWA = cLow.some(c => c.includes("whatsapp") || c.includes("instagram"));
    const hasRetrabalho = pains.some(p => ["retrabalho", "manual", "repetitivo"].some(k => p.toLowerCase().includes(k)));

    if (hasWA && (gLow.includes("conversão") || gLow.includes("vender") || gLow.includes("vendas"))) { ms.add("Vendas"); ms.add("Suporte"); }
    if ((hasCRM || hasERP) && score >= 15) { ms.add("Backoffice"); ms.add("Dados"); }
    if (gLow.includes("padronizar") && hasRetrabalho) { ms.add("Suporte"); ms.add("Backoffice"); }
    if (ms.size === 0) ms.add("Automação Operacional Básica");
    return Array.from(ms).slice(0, 3) as Mission[];
}

// ─── 2) selectTemplates ───────────────────────────────────────────────────────

/**
 * Deterministically selects template keys based on snapshot.
 * Priority order: tier → industry → missions → channels.
 */
export function selectTemplates(snap: InputSnapshot): string[] {
    const keys: string[] = [];

    // Tier + industry compound rules
    if (snap.tier === "hot") {
        if (snap.industry === "clinic") keys.push("clinic_stack_v1");
        else if (snap.industry === "saas") keys.push("outbound_saas_v1");
        else keys.push("whatsapp_funnel_v1");

        // If high budget hot, add full stack
        if (snap.estimatedBudget === "high") keys.push("full_stack_v1");
    } else if (snap.tier === "warm") {
        if (snap.hasLinkedIn || snap.industry === "saas") keys.push("outbound_saas_v1");
        else if (snap.industry === "clinic") keys.push("clinic_stack_v1");
        else keys.push("whatsapp_funnel_v1");
        if (snap.hasCRM || snap.hasERP) keys.push("data_heavy_v1");
    } else {
        // cold — lite only
        keys.push("lite_v1");
    }

    // Mission overrides
    if (snap.missions.includes("Dados") && !keys.includes("data_heavy_v1")) keys.push("data_heavy_v1");
    if (snap.hasInstagram && !keys.includes("ecommerce_v1")) keys.push("ecommerce_v1");

    // Deduplicate, stable order (preserves first occurrence)
    const seen = new Set<string>();
    return keys.filter(k => { if (seen.has(k)) return false; seen.add(k); return true; });
}

// ─── 3) compileBlueprint ──────────────────────────────────────────────────────

/**
 * Merges templates + snapshot into a canonical Blueprint.
 * 100% deterministic: same inputs → same output JSON.
 */
export function compileBlueprint(
    templateKeys: string[],
    snap: InputSnapshot,
    overrideModules?: string[],
): Blueprint {
    const now = snap.snapshotAt; // pin generatedAt to snapshot time

    // ── Resolve module set ────────────────────────────────────────────────────
    const moduleKeys = new Set<string>(overrideModules ?? []);
    for (const tk of templateKeys) {
        for (const mk of TEMPLATE_MODULE_MAP[tk] ?? []) moduleKeys.add(mk);
    }

    // If proposal specified modules, add them
    for (const pm of snap.proposedModules) {
        const mk = pm.toLowerCase().replace(/\s+/g, "_");
        if (MODULE_CATALOG[mk]) moduleKeys.add(mk);
    }

    // Sort for stable ordering
    const sortedKeys = Array.from(moduleKeys).sort();
    const selectedModules: BlueprintModule[] = sortedKeys.map(k => {
        const def = MODULE_CATALOG[k];
        if (!def) return null;
        return { ...def, enabled: true };
    }).filter(Boolean) as BlueprintModule[];

    // Sort by priority asc, then key asc (deterministic)
    selectedModules.sort((a, b) =>
        a.priority !== b.priority ? a.priority - b.priority : a.key.localeCompare(b.key)
    );

    // ── Integrations ──────────────────────────────────────────────────────────
    const intgKeys = new Set<string>(["openai", "prisma_db"]);  // always required
    if (snap.hasWhatsApp) intgKeys.add("meta_whatsapp");
    if (snap.hasInstagram) intgKeys.add("instagram_graph");
    if (snap.hasLinkedIn) intgKeys.add("linkedin_api");
    if (moduleKeys.has("calendly_booking")) intgKeys.add("calendly");
    if (moduleKeys.has("google_calendar")) intgKeys.add("google_calendar");

    // Mark required if module is enabled
    const integrations: Integration[] = Array.from(intgKeys).sort().map(k => {
        const def = INTEGRATION_CATALOG[k];
        if (!def) return null;
        return {
            ...def,
            required: def.required || ["meta_whatsapp", "instagram_graph", "openai", "prisma_db"].includes(k),
        };
    }).filter(Boolean) as Integration[];

    // ── Routes ────────────────────────────────────────────────────────────────
    const routes: AppRoute[] = ALL_ROUTES.filter(r => {
        if (r.role === "public") return true;
        if (r.label === "Builder Autopilot") return snap.orgId.includes("inovacortex");
        if (r.label === "Executive Pack") return snap.tier === "hot" || snap.estimatedBudget === "high";
        if (r.label === "Business Radar") return snap.tier !== "cold";
        return true;
    });

    // ── Task templates ────────────────────────────────────────────────────────
    const taskTemplates: TaskTemplate[] = buildTaskTemplates(selectedModules, snap);

    // ── Settings ──────────────────────────────────────────────────────────────
    const settings: Setting[] = buildSettings(snap, intgKeys);

    // ── Preflight checks ──────────────────────────────────────────────────────
    const preflightChecks: PreflightCheck[] = [
        { id: "db_connected", description: "Database connection verified", blocking: true },
        { id: "env_vars_set", description: "All required env vars present", blocking: true },
        { id: "openai_key", description: "OPENAI_API_KEY set and valid", blocking: true },
        ...(snap.hasWhatsApp ? [{ id: "waba_token", description: "WABA token set", blocking: true }] : []),
        ...(snap.hasLinkedIn ? [{ id: "linkedin_token", description: "LinkedIn API token configured", blocking: false }] : []),
        { id: "admin_seed", description: "At least one admin user seeded", blocking: false },
        { id: "org_slug_set", description: "Organization slug configured", blocking: true },
        { id: "domain_configured", description: "Custom domain or vercel URL set", blocking: false },
    ];

    // ── Rollout plan ──────────────────────────────────────────────────────────
    const rolloutPlan: RolloutPhase[] = buildRollout(snap, selectedModules);

    // ── Assemble + checksum ───────────────────────────────────────────────────
    const draft: Omit<Blueprint, "_checksum"> = {
        version: "1.0",
        generatedAt: now,
        orgId: snap.orgId,
        tier: snap.tier,
        selectedModules,
        integrations,
        routes,
        taskTemplates,
        settings,
        preflightChecks,
        rolloutPlan,
    };

    const stable = stableJson(draft);
    const _checksum = checksum(stable);

    return { ...draft, _checksum };
}

// ─── Task template builder ────────────────────────────────────────────────────

function buildTaskTemplates(modules: BlueprintModule[], snap: InputSnapshot): TaskTemplate[] {
    const t: TaskTemplate[] = [
        { phase: "1 – Setup", title: "Clonar repositório + configurar .env", owner: "inovacortex", estimateDays: 1 },
        { phase: "1 – Setup", title: "Rodar migrations Prisma", owner: "inovacortex", estimateDays: 1 },
        { phase: "1 – Setup", title: "Criar organização + seed admin", owner: "inovacortex", estimateDays: 1 },
        { phase: "2 – Integrações", title: "Configurar OpenAI API key", owner: "client", estimateDays: 1 },
    ];

    if (snap.hasWhatsApp) {
        t.push({ phase: "2 – Integrações", title: "Conectar WABA (Meta WhatsApp Business API)", owner: "client", estimateDays: 2 });
        t.push({ phase: "2 – Integrações", title: "Configurar webhook WhatsApp", owner: "inovacortex", estimateDays: 1 });
    }
    if (modules.some(m => m.key === "calendly_booking")) {
        t.push({ phase: "2 – Integrações", title: "Configurar API Calendly + webhook", owner: "client", estimateDays: 1 });
    }
    if (modules.some(m => m.key === "crm_sync")) {
        t.push({ phase: "2 – Integrações", title: "Conectar CRM via API", owner: "client", estimateDays: 2 });
    }
    if (modules.some(m => m.key === "outbound_sequences")) {
        t.push({ phase: "3 – Config", title: "Cadastrar sequências de outbound", owner: "inovacortex", estimateDays: 2 });
        t.push({ phase: "3 – Config", title: "Importar lista de prospects LinkedIn", owner: "client", estimateDays: 1 });
    }

    t.push({ phase: "3 – Config", title: "Configurar agentes IA (persona + prompts)", owner: "inovacortex", estimateDays: 2 });
    t.push({ phase: "3 – Config", title: "Validar fluxo de leads ponta a ponta", owner: "inovacortex", estimateDays: 2 });
    t.push({ phase: "4 – QA", title: "Teste de funil completo (lead → proposta → fecha)", owner: "inovacortex", estimateDays: 2 });
    t.push({ phase: "4 – QA", title: "Revisão com cliente + ajustes finais", owner: "client", estimateDays: 1 });
    t.push({ phase: "5 – Go-live", title: "Deploy em produção + monitoramento 48h", owner: "inovacortex", estimateDays: 2 });
    t.push({ phase: "5 – Go-live", title: "Treinamento equipe do cliente", owner: "inovacortex", estimateDays: 1 });

    return t;
}

// ─── Settings builder ─────────────────────────────────────────────────────────

function buildSettings(snap: InputSnapshot, intgKeys: Set<string>): Setting[] {
    const s: Setting[] = [
        { key: "OPENAI_API_KEY", defaultValue: "", required: true, description: "OpenAI API key for AI agents" },
        { key: "ADMIN_SECRET_TOKEN", defaultValue: "", required: true, description: "Admin API secret token" },
        { key: "NEXTAUTH_SECRET", defaultValue: "", required: true, description: "NextAuth session secret" },
        { key: "DATABASE_URL", defaultValue: "file:./dev.db", required: true, description: "Prisma DB connection string" },
        { key: "NEXT_PUBLIC_APP_URL", defaultValue: "http://localhost:3000", required: true, description: "Public app URL" },
    ];
    if (intgKeys.has("meta_whatsapp")) {
        s.push({ key: "WHATSAPP_TOKEN", defaultValue: "", required: true, description: "WhatsApp Business API bearer token" });
        s.push({ key: "WHATSAPP_PHONE_ID", defaultValue: "", required: true, description: "WhatsApp phone number ID" });
    }
    if (intgKeys.has("calendly")) {
        s.push({ key: "CALENDLY_API_KEY", defaultValue: "", required: false, description: "Calendly personal API token" });
    }
    if (intgKeys.has("google_calendar")) {
        s.push({ key: "GOOGLE_CLIENT_ID", defaultValue: "", required: false, description: "Google OAuth client ID" });
        s.push({ key: "GOOGLE_CLIENT_SECRET", defaultValue: "", required: false, description: "Google OAuth client secret" });
    }
    if (intgKeys.has("linkedin_api")) {
        s.push({ key: "LINKEDIN_CLIENT_ID", defaultValue: "", required: false, description: "LinkedIn API client ID" });
    }
    return s;
}

// ─── Rollout builder ──────────────────────────────────────────────────────────

function buildRollout(snap: InputSnapshot, modules: BlueprintModule[]): RolloutPhase[] {
    const coreModules = modules.filter(m => m.priority <= 2).map(m => m.key);
    const advancedModules = modules.filter(m => m.priority === 3).map(m => m.key);
    const premiumModules = modules.filter(m => m.priority >= 4).map(m => m.key);

    const phases: RolloutPhase[] = [
        {
            phase: 1, name: "Foundation",
            duration: snap.tier === "hot" ? "5 dias" : "7 dias",
            goals: ["Infraestrutura configurada", "Banco de dados migrado", "Admin funcional"],
            modules: coreModules.slice(0, 3),
        },
        {
            phase: 2, name: "Integrações Core",
            duration: snap.tier === "hot" ? "7 dias" : "10 dias",
            goals: ["Agentes IA conectados", "Canais integrados", "Primeiro lead capturado"],
            modules: coreModules,
        },
    ];

    if (advancedModules.length > 0) {
        phases.push({
            phase: 3, name: "Módulos Avançados",
            duration: "7 dias",
            goals: ["CRM/ERP sincronizado", "Outbound ativo", "Sequências configuradas"],
            modules: advancedModules,
        });
    }
    if (premiumModules.length > 0 || snap.tier === "hot") {
        phases.push({
            phase: phases.length + 1, name: "Premium & Otimização",
            duration: "5 dias",
            goals: ["Executive Pack ativo", "Profit Leak Detector rodando", "Dashboard CEO configurado"],
            modules: premiumModules,
        });
    }

    phases.push({
        phase: phases.length + 1, name: "Go-live & Monitoramento",
        duration: "3 dias",
        goals: ["Deploy em produção", "Funil testado ponta a ponta", "Equipe treinada"],
        modules: [],
    });

    return phases;
}
