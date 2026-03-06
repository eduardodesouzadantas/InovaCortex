import { AgentImplementation } from "./types";
import { ProposalDraftAgent } from "./executors/proposal-draft-executor";
import { OnboardingAgent } from "./executors/onboarding-executor";
import { MemoryAgent } from "./executors/memory-executor";
import { PerformanceAgent } from "./executors/performance-executor";
import { PlaybookAgent } from "./executors/playbook-executor";

const agents = new Map<string, AgentImplementation>();

// Register built-in agents
registerAgent(ProposalDraftAgent);
registerAgent(OnboardingAgent);
registerAgent(MemoryAgent);
registerAgent(PerformanceAgent);
registerAgent(PlaybookAgent);


export function registerAgent(agent: AgentImplementation) {
    agents.set(agent.name, agent);
}

export function getAgent(name: string): AgentImplementation | undefined {
    return agents.get(name);
}

export function getAllAgents(): AgentImplementation[] {
    return Array.from(agents.values());
}
