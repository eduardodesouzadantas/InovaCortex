type ApiEnvelope<T> = {
    success?: boolean;
    data?: T;
    error?: string;
};

function extractErrorMessage(payload: unknown, fallback: string): string {
    if (payload && typeof payload === "object") {
        const record = payload as Record<string, unknown>;
        if (typeof record.error === "string" && record.error.trim()) {
            return record.error;
        }
    }

    return fallback;
}

export async function readApiData<T>(response: Response, fallbackMessage: string): Promise<T> {
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(extractErrorMessage(payload, fallbackMessage));
    }

    if (
        payload
        && typeof payload === "object"
        && "success" in payload
        && "data" in payload
    ) {
        return (payload as ApiEnvelope<T>).data as T;
    }

    return payload as T;
}
