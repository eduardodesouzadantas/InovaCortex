import { NextRequest, NextResponse } from "next/server";

import { acceptOrganizationInvite } from "@/lib/auth/invite-service";
import { apiError, apiSuccess } from "@/lib/http/api-response";
import { logger, withApiLogging } from "@/lib/logger";

export const runtime = "nodejs";

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function buildHtmlPage(options: {
    token: string;
    title: string;
    message?: string;
    tone?: "error" | "success";
}): string {
    const messageMarkup = options.message
        ? `<div class="message ${options.tone ?? "success"}">${escapeHtml(options.message)}</div>`
        : "";

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)}</title>
    <style>
        :root {
            color-scheme: dark;
            --bg: #07111d;
            --panel: rgba(8, 21, 37, 0.96);
            --border: rgba(255, 255, 255, 0.08);
            --accent: #22d3ee;
            --accent-soft: rgba(34, 211, 238, 0.12);
            --text: #e2e8f0;
            --muted: #94a3b8;
            --error: #fda4af;
            --error-bg: rgba(244, 63, 94, 0.14);
            --success: #a7f3d0;
            --success-bg: rgba(16, 185, 129, 0.14);
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
            color: var(--text);
            background:
                radial-gradient(circle at top left, rgba(34, 211, 238, 0.12), transparent 28%),
                radial-gradient(circle at bottom right, rgba(14, 165, 233, 0.10), transparent 30%),
                var(--bg);
        }
        .wrap {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
        }
        .card {
            width: min(100%, 560px);
            border: 1px solid var(--border);
            border-radius: 28px;
            background: var(--panel);
            padding: 32px;
            box-shadow: 0 30px 120px rgba(0, 0, 0, 0.28);
        }
        .eyebrow {
            display: inline-flex;
            border: 1px solid rgba(34, 211, 238, 0.2);
            background: var(--accent-soft);
            color: #cffafe;
            padding: 6px 12px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
        }
        h1 {
            margin: 18px 0 10px;
            font-size: 32px;
            line-height: 1.1;
            letter-spacing: -0.03em;
        }
        p {
            margin: 0;
            color: var(--muted);
            line-height: 1.7;
        }
        .message {
            margin-top: 20px;
            border-radius: 18px;
            padding: 14px 16px;
            font-size: 14px;
        }
        .message.error {
            border: 1px solid rgba(251, 113, 133, 0.2);
            background: var(--error-bg);
            color: var(--error);
        }
        .message.success {
            border: 1px solid rgba(52, 211, 153, 0.2);
            background: var(--success-bg);
            color: var(--success);
        }
        form {
            margin-top: 24px;
            display: grid;
            gap: 16px;
        }
        label {
            display: grid;
            gap: 8px;
            font-size: 14px;
            color: #cbd5e1;
        }
        input {
            height: 48px;
            border-radius: 18px;
            border: 1px solid rgba(255, 255, 255, 0.10);
            background: rgba(0, 0, 0, 0.22);
            color: white;
            padding: 0 16px;
            font-size: 14px;
            outline: none;
        }
        input:focus {
            border-color: rgba(34, 211, 238, 0.5);
        }
        button {
            height: 48px;
            border: 0;
            border-radius: 18px;
            background: #22d3ee;
            color: #08111d;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
        }
        .footer {
            margin-top: 18px;
            font-size: 12px;
            color: #64748b;
        }
        a {
            color: #a5f3fc;
        }
    </style>
</head>
<body>
    <main class="wrap">
        <section class="card">
            <span class="eyebrow">Invite access</span>
            <h1>${escapeHtml(options.title)}</h1>
            <p>Defina seu nome e sua senha para concluir o acesso a conta da empresa.</p>
            ${messageMarkup}
            <form method="post" action="/api/auth/invite/accept">
                <input type="hidden" name="token" value="${escapeHtml(options.token)}" />
                <label>
                    Nome
                    <input type="text" name="name" autocomplete="name" required minlength="2" placeholder="Seu nome completo" />
                </label>
                <label>
                    Senha
                    <input type="password" name="password" autocomplete="new-password" required minlength="8" placeholder="Senha inicial" />
                </label>
                <label>
                    Confirmar senha
                    <input type="password" name="confirmPassword" autocomplete="new-password" required minlength="8" placeholder="Repita a senha" />
                </label>
                <button type="submit">Ativar acesso</button>
            </form>
            <div class="footer">Se algo falhar, solicite um novo convite a Agency.</div>
        </section>
    </main>
</body>
</html>`;
}

async function readRequestBody(request: NextRequest): Promise<{ token?: string; name?: string; password?: string; confirmPassword?: string } | null> {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
        return request.json().catch(() => null);
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) {
        return null;
    }

    return {
        token: typeof formData.get("token") === "string" ? String(formData.get("token")) : undefined,
        name: typeof formData.get("name") === "string" ? String(formData.get("name")) : undefined,
        password: typeof formData.get("password") === "string" ? String(formData.get("password")) : undefined,
        confirmPassword: typeof formData.get("confirmPassword") === "string" ? String(formData.get("confirmPassword")) : undefined,
    };
}

function wantsJson(request: NextRequest): boolean {
    const accept = request.headers.get("accept") ?? "";
    const contentType = request.headers.get("content-type") ?? "";
    return accept.includes("application/json") || contentType.includes("application/json");
}

async function GETHandler(request: NextRequest) {
    const token = new URL(request.url).searchParams.get("token")?.trim() ?? "";
    if (!token) {
        return new NextResponse(buildHtmlPage({
            token: "",
            title: "Invite invalido",
            message: "Link de convite ausente.",
            tone: "error",
        }), {
            status: 400,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
            },
        });
    }

    return new NextResponse(buildHtmlPage({
        token,
        title: "Aceitar convite",
    }), {
        headers: {
            "Content-Type": "text/html; charset=utf-8",
        },
    });
}

async function POSTHandler(request: NextRequest) {
    const queryToken = new URL(request.url).searchParams.get("token")?.trim() ?? "";
    const body = await readRequestBody(request);
    const token = (body?.token?.trim() ?? queryToken).trim();
    const name = (body?.name ?? "").trim();
    const password = (body?.password ?? "").trim();
    const confirmPassword = (body?.confirmPassword ?? "").trim();

    if (!token || !name || !password) {
        if (wantsJson(request)) {
            return apiError(request, {
                message: "TOKEN_NAME_AND_PASSWORD_REQUIRED",
                code: "BAD_REQUEST",
            }, { status: 400 });
        }

        return new NextResponse(buildHtmlPage({
            token,
            title: "Aceitar convite",
            message: "Token, nome e senha sao obrigatorios.",
            tone: "error",
        }), {
            status: 400,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
            },
        });
    }

    if (confirmPassword && confirmPassword !== password) {
        if (wantsJson(request)) {
            return apiError(request, {
                message: "PASSWORDS_DO_NOT_MATCH",
                code: "BAD_REQUEST",
            }, { status: 400 });
        }

        return new NextResponse(buildHtmlPage({
            token,
            title: "Aceitar convite",
            message: "As senhas nao coincidem.",
            tone: "error",
        }), {
            status: 400,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
            },
        });
    }

    const result = await acceptOrganizationInvite({
        token,
        name,
        password,
    });

    if (!result.ok) {
        if (wantsJson(request)) {
            const status = result.reason === "expired_token"
                ? 410
                : result.reason === "email_conflict" || result.reason === "user_limit_reached"
                    ? 409
                    : 400;
            return apiError(request, {
                message: result.reason === "expired_token"
                    ? "TOKEN_EXPIRED"
                    : result.reason === "weak_password"
                        ? "WEAK_PASSWORD"
                        : result.reason === "email_conflict"
                            ? "EMAIL_CONFLICT"
                            : result.reason === "user_limit_reached"
                                ? "USER_LIMIT_REACHED"
                            : "INVALID_INVITE_TOKEN",
                code: result.reason === "expired_token"
                    ? "TOKEN_EXPIRED"
                    : result.reason === "weak_password"
                        ? "BAD_REQUEST"
                        : result.reason === "email_conflict"
                            ? "CONFLICT"
                            : result.reason === "user_limit_reached"
                                ? "CONFLICT"
                            : "INVALID_INVITE_TOKEN",
            }, { status });
        }

        const htmlStatus = result.reason === "expired_token"
            ? 410
            : result.reason === "email_conflict" || result.reason === "user_limit_reached"
                ? 409
                : 400;

        return new NextResponse(buildHtmlPage({
            token,
            title: "Aceitar convite",
            message:
                result.reason === "expired_token"
                    ? "Convite expirado."
                    : result.reason === "weak_password"
                        ? "Senha precisa ter pelo menos 8 caracteres."
                        : result.reason === "email_conflict"
                            ? "Este e-mail ja esta em uso."
                            : result.reason === "user_limit_reached"
                                ? "Limite de usuarios da organization atingido."
                            : "Convite invalido.",
            tone: "error",
        }), {
            status: htmlStatus,
            headers: {
                "Content-Type": "text/html; charset=utf-8",
            },
        });
    }

    logger.info("Invite accepted", {
        operation: "authInvite.accept",
        organizationId: result.organizationId,
        userId: result.userId,
    });

    if (wantsJson(request)) {
        return apiSuccess(request, {
            organizationId: result.organizationId,
            organizationName: result.organizationName,
            userId: result.userId,
            email: result.email,
        });
    }

    const loginUrl = new URL("/empresa/login", request.url);
    loginUrl.searchParams.set("invite", "accepted");
    loginUrl.searchParams.set("email", result.email);
    return NextResponse.redirect(loginUrl, 303);
}

export const GET = withApiLogging("/api/auth/invite/accept", "GET", GETHandler);
export const POST = withApiLogging("/api/auth/invite/accept", "POST", POSTHandler);
