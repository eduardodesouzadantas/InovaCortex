/**
 * lib/builder/prompt-pack.ts
 * V25.2: Prompt Pack Generator.
 *
 * Given a Blueprint JSON, produces up to 6 prompts in sequence,
 * ready to paste into Antigravity in order.
 *
 * Public API:
 *   buildPromptPack(blueprint, options) → PromptPack
 *   persistPromptPack(pack, buildRunId, orgId) → BuildArtifact[]
 */

import type { Blueprint, BlueprintModule } from "./blueprint-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PromptPart {
    index: number;        // 1-based
    title: string;
    objective: string;
    filesToCreate: string[];
    filesToModify: string[];
    acceptanceCriteria: string[];
    verificationCommands: string[];
    doNotChange: string[];
    styleRules: string[];
    body: string;         // full rendered text for copy-paste
}

export interface PromptPackOptions {
    maxParts?: number;   // default 6
    orgSlug?: string;   // used to fill path placeholders
    includeTests?: boolean;  // default true
}

export interface PromptPack {
    blueprintChecksum: string;
    tier: string;
    orgId: string;
    generatedAt: string;
    parts: PromptPart[];
}

// ─── Allowed directory roots (do-not-change constraint) ──────────────────────

export const ALLOWED_DIRS = [
    "app/",
    "components/",
    "lib/",
    "prisma/",
    "public/",
] as const;

// ─── Style rules (shared across all parts) ───────────────────────────────────

const GLOBAL_STYLE_RULES: string[] = [
    "Dark background #0b0b0f, gold accents #d4af37, indigo #6366f1.",
    "Glassmorphism cards — rgba(255,255,255,0.04) background, subtle border.",
    "Framer Motion for all entrance animations (opacity + y translate).",
    "TypeScript strict mode — no `any` casts except Prisma dynamic access.",
    "All new components must have premium UI (not MVP/skeleton).",
    "Run `npx tsc --noEmit` before declaring done.",
    "All vitest tests must be green before marking task complete.",
];

const DO_NOT_CHANGE: string[] = [
    "prisma/schema.prisma (unless explicitly instructed)",
    "lib/prisma.ts (singleton)",
    "lib/scoring.ts (scoring logic)",
    ".env (never commit secrets)",
    "node_modules/",
    "Any file not mentioned in filesToCreate or filesToModify",
];

// ─── Part builders ────────────────────────────────────────────────────────────

interface PartSpec {
    title: string;
    objective: string;
    filesToCreate: string[];
    filesToModify: string[];
    acceptanceCriteria: string[];
    verificationCommands: string[];
    extraDoNotChange?: string[];
}

function renderBody(index: number, spec: PartSpec, styleRules: string[], doNotChange: string[]): string {
    const block = (label: string, lines: string[]) =>
        `### ${label}\n${lines.map(l => `- ${l}`).join("\n")}`;

    return [
        `# Prompt ${index}: ${spec.title}`,
        "",
        `**Objective:** ${spec.objective}`,
        "",
        block("Files to Create", spec.filesToCreate.length ? spec.filesToCreate : ["(none)"]),
        "",
        block("Files to Modify", spec.filesToModify.length ? spec.filesToModify : ["(none)"]),
        "",
        block("Acceptance Criteria", spec.acceptanceCriteria),
        "",
        block("Verification Commands", spec.verificationCommands),
        "",
        block("Do NOT Change", [...doNotChange, ...(spec.extraDoNotChange ?? [])]),
        "",
        block("Style Rules", styleRules),
    ].join("\n");
}

// ─── Part 1: DB + Schema ──────────────────────────────────────────────────────

function part1_schema(bp: Blueprint, slug: string): PartSpec {
    const newModels = ["(confirm migration with `npx prisma migrate dev --name <name> --skip-seed`)"];
    return {
        title: "Database & Schema",
        objective: "Apply any missing Prisma migrations and seed the organization row. Ensure all V25 models (BuildTemplate, BuildRun, BuildArtifact, AppSetting) are in the DB.",
        filesToCreate: [],
        filesToModify: [
            "prisma/schema.prisma (only if new model needed — check first)",
        ],
        acceptanceCriteria: [
            "`npx prisma migrate status` shows all migrations applied",
            `Organization slug "${slug}" exists in the \`organizations\` table`,
            "`npx prisma generate` exits 0",
            "All existing vitest suites still pass",
        ],
        verificationCommands: [
            "npx prisma migrate status",
            "npx prisma generate",
            `npx vitest run --reporter=verbose`,
        ],
        extraDoNotChange: ["Do not add @db.Text — SQLite does not support it"],
    };
}

// ─── Part 2: Core modules ─────────────────────────────────────────────────────

function part2_coreModules(bp: Blueprint, slug: string): PartSpec {
    const coreModules = bp.selectedModules.filter(m => m.priority <= 2);
    const fileSets = coreModules.map(m => moduleToFiles(m, slug));
    const createFiles = [...new Set(fileSets.flatMap(f => f.create))];
    const modifyFiles = [...new Set(fileSets.flatMap(f => f.modify))];

    const moduleList = coreModules.map(m => `\`${m.key}\` (${m.label})`).join(", ");

    return {
        title: "Core Modules",
        objective: `Implement the core modules: ${moduleList}. These are the highest-priority agents and flows.`,
        filesToCreate: createFiles.slice(0, 8),
        filesToModify: modifyFiles.slice(0, 4),
        acceptanceCriteria: [
            "All listed modules render in the admin dashboard without errors",
            "Each module has at least 1 vitest unit test",
            "`npx tsc --noEmit` exits 0",
            "No hardcoded secrets in any created file",
        ],
        verificationCommands: [
            "npx tsc --noEmit",
            "npx vitest run --reporter=verbose",
            "npm run dev (check browser console for 0 errors)",
        ],
    };
}

// ─── Part 3: Integrations ─────────────────────────────────────────────────────

function part3_integrations(bp: Blueprint): PartSpec {
    const required = bp.integrations.filter(i => i.required);
    const optional = bp.integrations.filter(i => !i.required);
    const reqList = required.map(i => `${i.label} — \`${i.key}\``).join(", ");
    const optList = optional.map(i => i.label).join(", ");

    return {
        title: "Integrations & Environment",
        objective: `Configure all required integrations: ${reqList}. Optional: ${optList || "none"}.`,
        filesToCreate: [
            "lib/integrations/whatsapp.ts (if hasWhatsApp)",
            "lib/integrations/calendly.ts (if calendly selected)",
        ].filter(f => bp.integrations.some(i =>
            (f.includes("whatsapp") && i.key === "meta_whatsapp") ||
            (f.includes("calendly") && i.key === "calendly")
        )),
        filesToModify: [
            ".env.example (add all required env var keys with empty values)",
            "lib/integrations/index.ts (export new clients)",
        ],
        acceptanceCriteria: [
            ".env.example contains all keys from `settings` in blueprint (no values — keys only)",
            "Each integration client wraps fetch with proper error handling",
            "No secrets committed — only env var references",
            "Integration modules export a typed client interface",
        ],
        verificationCommands: [
            "grep -r 'WHATSAPP_TOKEN\\|OPENAI_API_KEY' lib/ --include='*.ts'  # should only find references, not actual values",
            "npx tsc --noEmit",
        ],
    };
}

// ─── Part 4: Pages + Routes ───────────────────────────────────────────────────

function part4_pagesRoutes(bp: Blueprint, slug: string): PartSpec {
    const adminRoutes = bp.routes.filter(r => r.role === "admin");
    const userRoutes = bp.routes.filter(r => r.role === "user");
    const routeList = adminRoutes.map(r => `\`${r.path}\` — ${r.label}`).join(", ");

    return {
        title: "Pages & Routes",
        objective: `Enable all admin and user-facing routes. Admin routes: ${routeList}.`,
        filesToCreate: [
            ...adminRoutes.map(r => `app${r.path.replace("[slug]", slug)}/page.tsx`).slice(0, 4),
        ],
        filesToModify: [
            `app/org/${slug}/admin/layout.tsx (add nav links for new pages)`,
        ],
        acceptanceCriteria: [
            "All admin routes load without 404 or runtime error",
            "Route guards return 404 for unauthorized orgs (not 403)",
            "Each page has a `<title>` via Next.js metadata export",
            "Pages use glassmorphism design system (no plain white/grey UI)",
        ],
        verificationCommands: [
            "npm run dev",
            "curl -I http://localhost:3000/org/[slug]/admin (expect 200 or redirect)",
            "npx tsc --noEmit",
        ],
    };
}

// ─── Part 5: Tasks + Settings ─────────────────────────────────────────────────

function part5_tasksSettings(bp: Blueprint): PartSpec {
    const phases = [...new Set(bp.taskTemplates.map(t => t.phase))];
    const settingKeys = bp.settings.filter(s => s.required).map(s => s.key);

    return {
        title: "Task Templates & Settings Configuration",
        objective: `Generate task template rows for all ${bp.taskTemplates.length} planned tasks across ${phases.length} phases. Validate all required settings are reachable via environment.`,
        filesToCreate: [
            "lib/builder/seed-tasks.ts (seed BuildArtifact task templates into DB)",
        ],
        filesToModify: [
            ".env.example",
            "lib/builder/blueprint-engine.ts (if settings list needs updating)",
        ],
        acceptanceCriteria: [
            `All ${bp.taskTemplates.length} task templates are seeded and readable via API`,
            `Required env vars present: ${settingKeys.slice(0, 4).join(", ")}`,
            "Seeder script exits 0 without throwing",
            "`npx vitest run` still green",
        ],
        verificationCommands: [
            "npx tsx lib/builder/seed-tasks.ts",
            "npx vitest run --reporter=verbose",
            "npx tsc --noEmit",
        ],
    };
}

// ─── Part 6: QA + Preflight ───────────────────────────────────────────────────

function part6_preflight(bp: Blueprint): PartSpec {
    const blocking = bp.preflightChecks.filter(c => c.blocking);
    const nonBlock = bp.preflightChecks.filter(c => !c.blocking);
    const phases = bp.rolloutPlan.map(p => `Phase ${p.phase}: ${p.name} (${p.duration})`).join(", ");

    return {
        title: "QA, Preflight & Go-live Checklist",
        objective: `Execute all preflight checks (${blocking.length} blocking, ${nonBlock.length} non-blocking) and validate rollout plan phases: ${phases}.`,
        filesToCreate: [
            "lib/builder/preflight-check.ts (runs each check and exits 1 on failure)",
        ],
        filesToModify: [],
        acceptanceCriteria: [
            `All ${blocking.length} blocking preflight checks pass`,
            "Full lead→proposal→close funnel tested end-to-end",
            "No TypeScript errors (`npx tsc --noEmit`)",
            "All vitest suites pass (including blueprint-engine + builder tests)",
            "PDF export tested with Puppeteer",
        ],
        verificationCommands: [
            "npx tsx lib/builder/preflight-check.ts",
            "npx vitest run --reporter=verbose",
            "npx tsc --noEmit",
            "npm run build (production build must succeed)",
        ],
    };
}

// ─── Module → file mapping ────────────────────────────────────────────────────

function moduleToFiles(m: BlueprintModule, slug: string): { create: string[]; modify: string[] } {
    const a = `app/org/${slug}`;
    const map: Record<string, { create?: string[]; modify?: string[] }> = {
        whatsapp_agent: { create: ["lib/integrations/whatsapp.ts", "app/api/webhooks/whatsapp/route.ts"], modify: ["lib/ai/agent.ts"] },
        instagram_agent: { create: ["lib/integrations/instagram.ts", "app/api/webhooks/instagram/route.ts"] },
        linkedin_outbound: { create: ["lib/integrations/linkedin.ts"] },
        email_sequences: { create: ["lib/integrations/email.ts"] },
        crm_sync: { create: ["lib/integrations/crm.ts"] },
        erp_integration: { create: ["lib/integrations/erp.ts"] },
        calendly_booking: { create: ["lib/integrations/calendly.ts", "app/api/webhooks/calendly/route.ts"] },
        google_calendar: { create: ["lib/integrations/google-calendar.ts"] },
        proposal_engine: { modify: ["lib/ai/agent.ts", "app/api/org/[slug]/proposals/route.ts"] },
        assessment_form: { modify: ["app/avaliacao/page.tsx", "app/api/assessment/route.ts"] },
        ai_brain: { modify: ["lib/ai/agent.ts", "lib/ai/orchestrator.ts"] },
        dashboard_cockpit: { create: [`${a}/admin/command-center/page.tsx`], modify: [`${a}/admin/command-center/command-center-client.tsx`] },
        profit_leak: { create: ["lib/profit-leak/scanner.ts"] },
        outbound_sequences: { create: ["lib/outbound/sequence-runner.ts"] },
        support_agent: { create: ["lib/support/support-agent.ts"] },
        backoffice_bot: { create: ["lib/backoffice/backoffice-bot.ts"] },
        data_pipeline: { create: ["lib/data/pipeline.ts"] },
        executive_pack: { create: [`${a}/admin/executive-pack/page.tsx`] },
    };
    const entry = map[m.key] ?? {};
    return { create: entry.create ?? [], modify: entry.modify ?? [] };
}

// ─── Main: buildPromptPack ────────────────────────────────────────────────────

export function buildPromptPack(
    blueprint: Blueprint,
    options: PromptPackOptions = {},
): PromptPack {
    const maxParts = Math.min(options.maxParts ?? 6, 6);
    const slug = options.orgSlug ?? "YOUR_ORG_SLUG";
    const withTests = options.includeTests ?? true;

    const styleRules = [
        ...GLOBAL_STYLE_RULES,
        ...(withTests ? ["Each new module must have a corresponding vitest test file."] : []),
    ];

    const specs: PartSpec[] = [
        part1_schema(blueprint, slug),
        part2_coreModules(blueprint, slug),
        part3_integrations(blueprint),
        part4_pagesRoutes(blueprint, slug),
        part5_tasksSettings(blueprint),
        part6_preflight(blueprint),
    ].slice(0, maxParts);

    const parts: PromptPart[] = specs.map((spec, i) => {
        const index = i + 1;
        const body = renderBody(index, spec, styleRules, DO_NOT_CHANGE);
        return {
            index,
            title: spec.title,
            objective: spec.objective,
            filesToCreate: spec.filesToCreate,
            filesToModify: spec.filesToModify,
            acceptanceCriteria: spec.acceptanceCriteria,
            verificationCommands: spec.verificationCommands,
            doNotChange: [...DO_NOT_CHANGE, ...(spec.extraDoNotChange ?? [])],
            styleRules,
            body,
        };
    });

    return {
        blueprintChecksum: blueprint._checksum,
        tier: blueprint.tier,
        orgId: blueprint.orgId,
        generatedAt: new Date().toISOString(),
        parts,
    };
}

// ─── Persist to DB as BuildArtifacts ─────────────────────────────────────────

export async function persistPromptPack(
    pack: PromptPack,
    buildRunId: string,
    orgId: string,
): Promise<any[]> {
    const { prisma } = await import("@/lib/prisma");

    // Find current max version for this run + type to auto-increment
    const existing = await (prisma as any).buildArtifact.aggregate({
        where: { buildRunId, type: "prompt_pack" },
        _max: { version: true },
    }).catch(() => ({ _max: { version: 0 } }));

    const baseVersion = (existing._max?.version ?? 0) + 1;

    const created = await Promise.all(pack.parts.map((part, i) =>
        (prisma as any).buildArtifact.create({
            data: {
                orgId,
                buildRunId,
                type: "prompt_pack",
                version: baseVersion + i,
                body: part.body,
            },
        })
    ));

    // Update run outputJson
    await (prisma as any).buildRun.update({
        where: { id: buildRunId },
        data: {
            outputJson: JSON.stringify({
                promptPack: {
                    checksum: pack.blueprintChecksum,
                    parts: pack.parts.length,
                    tier: pack.tier,
                },
            }),
            status: "review",
            updatedAt: new Date(),
        },
    }).catch(() => null);

    return created;
}

// ─── Utility: validate allowed dirs ──────────────────────────────────────────

/**
 * Returns true if every path in the array starts with an allowed directory root.
 */
export function allPathsAllowed(paths: string[]): boolean {
    return paths.every(p =>
        ALLOWED_DIRS.some(dir => p.startsWith(dir))
    );
}
