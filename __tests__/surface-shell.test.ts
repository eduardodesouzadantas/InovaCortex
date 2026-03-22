import { isAgencyLoginPath, isAgencyPath, isShelllessPath } from "../lib/navigation/surface-shell";

describe("surface-shell helpers", () => {
    it("marks agency surfaces as shellless", () => {
        expect(isAgencyPath("/agency")).toBe(true);
        expect(isAgencyPath("/agency/login")).toBe(true);
        expect(isShelllessPath("/agency/organizations")).toBe(true);
        expect(isShelllessPath("/mobile")).toBe(true);
        expect(isShelllessPath("/m")).toBe(true);
    });

    it("keeps public routes outside the shellless surface", () => {
        expect(isShelllessPath("/")).toBe(false);
        expect(isShelllessPath("/empresa/login")).toBe(false);
        expect(isAgencyLoginPath("/agency/login")).toBe(true);
    });
});
