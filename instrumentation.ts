export const runtime = "nodejs";

export async function register() {
    if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
        return;
    }

    const { ensureBackendActivation } = await import("@/lib/system/bootstrap");
    void ensureBackendActivation();
}
