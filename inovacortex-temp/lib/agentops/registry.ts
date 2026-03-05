/**
 * lib/agentops/registry.ts
 * V20.1: Pluggable Agent Registry.
 *
 * Agents are pure handlers: async (input, ctx) => output.
 * Defaults (model, maxTokens, temperature) are merged at call time.
 * Registry is in-memory, populated at module init (singleton).
 *
 * Usage:
 *   registerAgent("MyAgent", myHandler, { model: "gemini-2.0-flash", maxTokens: 2048 });
 *   const agent = getAgent("MyAgent")!;
 *   const result = await agent.handler(input, ctx);
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentContext {
    orgId: string;
    runId?: string;
    actionType?: string;
    [key: string]: any;
}

export interface AgentDefaults {
    model: string;
    maxTokens: number;
    temperature?: number;
    cacheEnabled?: boolean;
    fallbackToTemplate?: boolean;
}

export type AgentHandler<TInput = any, TOutput = any> = (
    input: TInput,
    ctx: AgentContext,
) => Promise<TOutput>;

export interface AgentRegistration<TInput = any, TOutput = any> {
    name: string;
    handler: AgentHandler<TInput, TOutput>;
    defaults: AgentDefaults;
    registeredAt: Date;
}

// ─── Internal Map ─────────────────────────────────────────────────────────────

const _registry = new Map<string, AgentRegistration>();

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Register an agent handler with a name and default configuration.
 * Calling twice with the same name overwrites silently (last write wins).
 */
export function registerAgent<TInput, TOutput>(
    name: string,
    handler: AgentHandler<TInput, TOutput>,
    defaults: Partial<AgentDefaults> = {},
): void {
    const resolved: AgentDefaults = {
        model: "gemini-2.0-flash",
        maxTokens: 2048,
        temperature: 0.3,
        cacheEnabled: true,
        fallbackToTemplate: true,
        ...defaults,
    };
    _registry.set(name, { name, handler, defaults: resolved, registeredAt: new Date() });
}

/**
 * Retrieve a registered agent by name.
 * Returns undefined if not found — caller must handle the miss.
 */
export function getAgent(name: string): AgentRegistration | undefined {
    return _registry.get(name);
}

/**
 * List all registered agent names and their defaults.
 */
export function getAllAgents(): AgentRegistration[] {
    return Array.from(_registry.values());
}

/**
 * Returns true if an agent with the given name is registered.
 */
export function hasAgent(name: string): boolean {
    return _registry.has(name);
}
