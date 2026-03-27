import { resolveLoginErrorMessage } from "../lib/auth/login-error-message";

describe("login error message mapping", () => {
    it.each([
        [{ code: "UNAUTHORIZED", error: "INVALID_CREDENTIALS" }, "Credenciais invalidas"],
        [{ code: "FORBIDDEN", error: "FORBIDDEN" }, "Acesso proibido para esta conta"],
        [{ code: "TOO_MANY_REQUESTS", error: "TOO_MANY_ATTEMPTS" }, "Muitas tentativas. Tente novamente em alguns minutos."],
        [{ code: "SERVICE_UNAVAILABLE", error: "DATABASE_UNAVAILABLE" }, "Servico temporariamente indisponivel. Tente novamente em instantes."],
        [{ code: "BAD_REQUEST", error: "INVALID_PAYLOAD" }, "Preencha todos os campos corretamente."],
        [{ code: "INTERNAL_ERROR", error: "INTERNAL_ERROR" }, "Ocorreu um erro inesperado. Tente novamente em instantes."],
        [{ code: "SOMETHING_ELSE", error: "SOMETHING_ELSE" }, "Acesso negado"],
    ])("maps %o to a safe message", (payload, expected) => {
        expect(resolveLoginErrorMessage(payload)).toBe(expected);
    });
});
