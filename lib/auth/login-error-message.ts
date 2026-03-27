export type LoginErrorPayload = {
    error?: string;
    code?: string;
};

function normalize(value: string | undefined): string {
    return value?.trim().toUpperCase() ?? "";
}

export function resolveLoginErrorMessage(payload: LoginErrorPayload | null | undefined): string {
    const code = normalize(payload?.code);
    const error = normalize(payload?.error);

    if (code === "UNAUTHORIZED" || error === "INVALID_CREDENTIALS" || error === "UNAUTHORIZED") {
        return "Credenciais invalidas";
    }

    if (code === "FORBIDDEN" || error === "FORBIDDEN") {
        return "Acesso proibido para esta conta";
    }

    if (code === "TOO_MANY_REQUESTS" || error === "TOO_MANY_ATTEMPTS") {
        return "Muitas tentativas. Tente novamente em alguns minutos.";
    }

    if (code === "SERVICE_UNAVAILABLE" || error === "DATABASE_UNAVAILABLE") {
        return "Servico temporariamente indisponivel. Tente novamente em instantes.";
    }

    if (code === "BAD_REQUEST" || error === "EMAIL_AND_PASSWORD_REQUIRED" || error === "INVALID_PAYLOAD") {
        return "Preencha todos os campos corretamente.";
    }

    if (code === "INTERNAL_ERROR" || error === "INTERNAL_ERROR") {
        return "Ocorreu um erro inesperado. Tente novamente em instantes.";
    }

    return "Acesso negado";
}
