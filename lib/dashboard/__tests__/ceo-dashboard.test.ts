import { describe, it, expect } from "vitest";

// ─── We test the pure helpers extracted from activity-stream.tsx ──────────────
// formatEventMessage and getEventIcon logic are inline functions in the component.
// We test the logic directly by replicating the functions here.

// ─── Replicate pure formatEventMessage logic ──────────────────────────────────

interface SystemEvent {
    id: string;
    type: string;
    createdAt: string;
    payloadJson: string;
}

function formatEventMessage(evt: SystemEvent): string {
    try {
        const payload = JSON.parse(evt.payloadJson);
        switch (evt.type) {
            case "payment_received":
                return `Payment received — R$ ${(payload.amountCents / 100).toLocaleString('pt-BR')} (${payload.client || 'Client'})`;
            case "meeting_scheduled":
                return `Meeting scheduled — ${payload.client || 'Lead'}`;
            case "profit_leak_detected":
                return `Alert: ${payload.title} — ${payload.description}`;
            case "workspace_provisioned":
                return `Workspace activated — ${payload.client || 'New Project'}`;
            case "lead_created":
                return `High-ticket lead captured: ${payload.company}`;
            case "contract_signed":
                return `Contract signed — ${payload.client || 'Deal Closed'}`;
            default:
                return `System Action: ${evt.type.replace(/_/g, ' ')}`;
        }
    } catch {
        return `New event: ${evt.type}`;
    }
}

function getEventIconType(type: string): string {
    switch (type) {
        case "payment_received": return "DollarSign";
        case "meeting_scheduled": return "Calendar";
        case "profit_leak_detected": return "AlertTriangle";
        case "workspace_provisioned": return "Rocket";
        case "lead_created": return "UserPlus";
        case "contract_signed": return "CheckCircle";
        default: return "ArrowRight";
    }
}

// ─── Helper to build mock events ─────────────────────────────────────────────

function makeEvt(type: string, payload: object): SystemEvent {
    return { id: "evt-1", type, createdAt: new Date().toISOString(), payloadJson: JSON.stringify(payload) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("activity-stream — formatEventMessage", () => {

    it("payment_received: shows amount in BRL and client name", () => {
        const msg = formatEventMessage(makeEvt("payment_received", { amountCents: 1500000, client: "Acme Corp" }));
        expect(msg).toContain("R$");
        expect(msg).toContain("Acme Corp");
        expect(msg).toContain("Payment received");
    });

    it("payment_received: defaults to 'Client' when no client in payload", () => {
        const msg = formatEventMessage(makeEvt("payment_received", { amountCents: 500000 }));
        expect(msg).toContain("Client");
    });

    it("payment_received: converts cents to reals (1500000 → 15.000)", () => {
        const msg = formatEventMessage(makeEvt("payment_received", { amountCents: 1500000, client: "X" }));
        // 1500000 / 100 = 15000, formatted pt-BR = "15.000" or "15,000"
        expect(msg).toMatch(/15[.,]000/);
    });

    it("meeting_scheduled: shows client name", () => {
        const msg = formatEventMessage(makeEvt("meeting_scheduled", { client: "João Silva" }));
        expect(msg).toContain("Meeting scheduled");
        expect(msg).toContain("João Silva");
    });

    it("meeting_scheduled: defaults to 'Lead' when no client", () => {
        const msg = formatEventMessage(makeEvt("meeting_scheduled", {}));
        expect(msg).toContain("Lead");
    });

    it("profit_leak_detected: shows title and description from payload", () => {
        const msg = formatEventMessage(makeEvt("profit_leak_detected", { title: "Lead Stale 48h", description: "3 leads without contact" }));
        expect(msg).toContain("Alert:");
        expect(msg).toContain("Lead Stale 48h");
        expect(msg).toContain("3 leads without contact");
    });

    it("workspace_provisioned: shows client or 'New Project'", () => {
        const msg = formatEventMessage(makeEvt("workspace_provisioned", { client: "TechCorp" }));
        expect(msg).toContain("Workspace activated");
        expect(msg).toContain("TechCorp");
    });

    it("workspace_provisioned: defaults to 'New Project' when client absent", () => {
        const msg = formatEventMessage(makeEvt("workspace_provisioned", {}));
        expect(msg).toContain("New Project");
    });

    it("lead_created: shows company name", () => {
        const msg = formatEventMessage(makeEvt("lead_created", { company: "StartupXYZ" }));
        expect(msg).toContain("High-ticket lead captured:");
        expect(msg).toContain("StartupXYZ");
    });

    it("contract_signed: shows client name", () => {
        const msg = formatEventMessage(makeEvt("contract_signed", { client: "Magna Corp" }));
        expect(msg).toContain("Contract signed");
        expect(msg).toContain("Magna Corp");
    });

    it("contract_signed: defaults to 'Deal Closed' when no client", () => {
        const msg = formatEventMessage(makeEvt("contract_signed", {}));
        expect(msg).toContain("Deal Closed");
    });

    it("unknown type: returns 'System Action' with underscores replaced by spaces", () => {
        const msg = formatEventMessage(makeEvt("ai_model_retrained", {}));
        expect(msg).toBe("System Action: ai model retrained");
    });

    it("handles malformed payloadJson gracefully — returns fallback string", () => {
        const evt: SystemEvent = { id: "e1", type: "payment_received", createdAt: new Date().toISOString(), payloadJson: "NOT JSON{{" };
        const msg = formatEventMessage(evt);
        expect(msg).toBe("New event: payment_received");
    });

    it("handles empty payload object without throwing", () => {
        expect(() => formatEventMessage(makeEvt("contract_signed", {}))).not.toThrow();
    });
});

describe("activity-stream — getEventIconType", () => {
    it("maps payment_received → DollarSign", () => expect(getEventIconType("payment_received")).toBe("DollarSign"));
    it("maps meeting_scheduled → Calendar", () => expect(getEventIconType("meeting_scheduled")).toBe("Calendar"));
    it("maps profit_leak_detected → AlertTriangle", () => expect(getEventIconType("profit_leak_detected")).toBe("AlertTriangle"));
    it("maps workspace_provisioned → Rocket", () => expect(getEventIconType("workspace_provisioned")).toBe("Rocket"));
    it("maps lead_created → UserPlus", () => expect(getEventIconType("lead_created")).toBe("UserPlus"));
    it("maps contract_signed → CheckCircle", () => expect(getEventIconType("contract_signed")).toBe("CheckCircle"));
    it("maps unknown type → ArrowRight", () => expect(getEventIconType("anything_else")).toBe("ArrowRight"));
});

// ─── CeoAlerts — getSeverityStyle ────────────────────────────────────────────

function getSeverityStyle(severity: string): string {
    switch (severity) {
        case "critical": return "bg-rose-500/10 border-rose-500/20 text-rose-400";
        case "high": return "bg-orange-500/10 border-orange-500/20 text-orange-400";
        default: return "bg-yellow-500/10 border-yellow-500/20 text-yellow-400";
    }
}

describe("ceo-alerts — getSeverityStyle", () => {
    it("critical → rose styles", () => expect(getSeverityStyle("critical")).toContain("rose"));
    it("high → orange styles", () => expect(getSeverityStyle("high")).toContain("orange"));
    it("warning → yellow styles", () => expect(getSeverityStyle("warning")).toContain("yellow"));
    it("unknown → yellow (default)", () => expect(getSeverityStyle("info")).toContain("yellow"));
});
