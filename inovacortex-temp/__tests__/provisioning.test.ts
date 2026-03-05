/**
 * __tests__/provisioning.test.ts
 * V12: Execution Engine tests — pure logic, no DB.
 * Imports from lib/provisioning-templates (no Prisma dependency).
 */

import {
    BASE_TASKS,
    MODULE_TASKS,
    BASE_CHECKLIST,
    MODULE_CHECKLIST,
    type TaskTemplate,
    type ChecklistTemplate,
} from "../lib/provisioning-templates";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTaskList(modules: string[]): { tasks: TaskTemplate[]; total: number } {
    const allTasks = [
        ...BASE_TASKS,
        ...modules.flatMap(m => MODULE_TASKS[m] ?? []),
    ].sort((a, b) => a.orderIndex - b.orderIndex);
    return { tasks: allTasks, total: allTasks.length };
}

function buildChecklist(modules: string[]): { items: ChecklistTemplate[]; total: number } {
    const allItems = [
        ...BASE_CHECKLIST,
        ...modules.flatMap(m => MODULE_CHECKLIST[m] ?? []),
    ];
    return { items: allItems, total: allItems.length };
}

// ─── BASE_TASKS ───────────────────────────────────────────────────────────────

describe("Provisioning: BASE_TASKS", () => {
    test("at least 6 base tasks defined", () => {
        expect(BASE_TASKS.length).toBeGreaterThanOrEqual(6);
    });

    test("all base tasks have required fields", () => {
        for (const task of BASE_TASKS) {
            expect(task.title).toBeTruthy();
            expect(task.description).toBeTruthy();
            expect(["owner", "admin", "closer"]).toContain(task.ownerRole);
            expect(["setup", "development", "launch", "handoff"]).toContain(task.phase);
            expect(task.dueDaysFromNow).toBeGreaterThan(0);
            expect(task.orderIndex).toBeGreaterThan(0);
        }
    });

    test("setup phase tasks come before development tasks (by dueDays)", () => {
        const setup = BASE_TASKS.filter(t => t.phase === "setup");
        const dev = BASE_TASKS.filter(t => t.phase === "development");
        expect(Math.max(...setup.map(t => t.dueDaysFromNow)))
            .toBeLessThan(Math.min(...dev.map(t => t.dueDaysFromNow)));
    });
});

// ─── MODULE_TASKS ─────────────────────────────────────────────────────────────

describe("Provisioning: MODULE_TASKS", () => {
    const knownModules = ["whatsapp-agent", "instagram-agent", "crm-integration", "erp-integration", "ai-support"];

    test("all known modules have tasks", () => {
        for (const m of knownModules) {
            expect(MODULE_TASKS[m]).toBeDefined();
            expect(MODULE_TASKS[m].length).toBeGreaterThan(0);
        }
    });

    test("whatsapp module includes webhook configuration task", () => {
        const tasks = MODULE_TASKS["whatsapp-agent"] ?? [];
        expect(tasks.some(t => t.title.toLowerCase().includes("webhook") || t.title.toLowerCase().includes("whatsapp"))).toBe(true);
    });

    test("unknown module returns undefined (falls back to [])", () => {
        expect(MODULE_TASKS["nonexistent"] ?? []).toHaveLength(0);
    });
});

// ─── Task List Assembly ───────────────────────────────────────────────────────

describe("Provisioning: buildTaskList", () => {
    test("no modules => only base tasks", () => {
        const { total } = buildTaskList([]);
        expect(total).toBe(BASE_TASKS.length);
    });

    test("whatsapp module adds extra tasks", () => {
        const { total: base } = buildTaskList([]);
        const { total: wa } = buildTaskList(["whatsapp-agent"]);
        expect(wa).toBeGreaterThan(base);
    });

    test("multiple modules stack correctly", () => {
        const expect_total = BASE_TASKS.length
            + (MODULE_TASKS["whatsapp-agent"] ?? []).length
            + (MODULE_TASKS["instagram-agent"] ?? []).length;
        const { total } = buildTaskList(["whatsapp-agent", "instagram-agent"]);
        expect(total).toBe(expect_total);
    });

    test("tasks are sorted by orderIndex ascending", () => {
        const { tasks } = buildTaskList(["whatsapp-agent", "crm-integration"]);
        for (let i = 1; i < tasks.length; i++) {
            expect(tasks[i].orderIndex).toBeGreaterThanOrEqual(tasks[i - 1].orderIndex);
        }
    });
});

// ─── Checklist Assembly ───────────────────────────────────────────────────────

describe("Provisioning: Checklist", () => {
    test("BASE_CHECKLIST has >= 3 general items", () => {
        expect(BASE_CHECKLIST.length).toBeGreaterThanOrEqual(3);
        expect(BASE_CHECKLIST.every(c => c.system && c.item)).toBe(true);
    });

    test("whatsapp module adds WhatsApp items", () => {
        const { items } = buildChecklist(["whatsapp-agent"]);
        expect(items.some(i => i.system === "WhatsApp")).toBe(true);
    });

    test("stacked modules produce larger checklist", () => {
        const { total: base } = buildChecklist([]);
        const { total: full } = buildChecklist(["whatsapp-agent", "crm-integration", "ai-support"]);
        expect(full).toBeGreaterThan(base);
    });
});

// ─── Idempotency Documentation ────────────────────────────────────────────────

describe("Provisioning: Idempotency", () => {
    test("same module list always produces same task count", () => {
        const modules = ["whatsapp-agent", "ai-support"];
        const { total: a } = buildTaskList(modules);
        const { total: b } = buildTaskList(modules);
        expect(a).toBe(b);
    });
});

// ─── Nudge Threshold Logic ────────────────────────────────────────────────────

describe("Provisioning: Nudge checks", () => {
    const isBlockedOverThreshold = (daysAgo: number, threshold = 3) => daysAgo >= threshold;
    const isStaleProvisioning = (daysAgo: number, threshold = 7) => daysAgo >= threshold;

    test("blocked task < 3 days — no alert", () => expect(isBlockedOverThreshold(2)).toBe(false));
    test("blocked task at 3 days — alert", () => expect(isBlockedOverThreshold(3)).toBe(true));
    test("provisioning < 7 days — no alert", () => expect(isStaleProvisioning(6)).toBe(false));
    test("provisioning at 7 days — alert", () => expect(isStaleProvisioning(7)).toBe(true));
});
