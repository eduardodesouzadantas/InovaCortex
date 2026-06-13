import * as actionsModule from "../app/agency/_components/agency-playbook-status-actions";

describe("Agency playbook status actions", () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    test("postAgencyPlaybookStatus sends JSON POST to new endpoint", async () => {
        const mockResponse = {
            ok: true,
            json: jest.fn().mockResolvedValue({ success: true, data: { status: "completed" } }),
        } as unknown as Response;
        (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

        const payload: Parameters<typeof actionsModule.postAgencyPlaybookStatus>[0] = { playbookId: "pb-x", action: "completed", owner: "bob", observedImpact: "Muito bom" };
        const result = await actionsModule.postAgencyPlaybookStatus(payload);

        expect(global.fetch).toHaveBeenCalledWith("/api/agency/playbooks/status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        expect(result).toEqual({ success: true, data: { status: "completed" } });
    });

    test("postAgencyPlaybookStatus throws when network fails", async () => {
        const mockResponse = {
            ok: false,
            status: 400,
            json: jest.fn().mockResolvedValue({ error: "MISSING_PLAYBOOK_ID" }),
        } as unknown as Response;
        (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

        await expect(actionsModule.postAgencyPlaybookStatus({ playbookId: "", action: "completed" })).rejects.toThrow("Playbook status update failed");
    });

});