import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/security/crypto";
import { getBaseUrl } from "@/lib/runtime/base-url";
import { badRequestError, failedDependencyError } from "@/lib/http/route-errors";
import { logger } from "@/lib/logger";
import { recordOnboardingEmailConnected } from "@/lib/onboarding-status";
import { z } from "zod";
import {
    EMAIL_OAUTH_PROVIDERS,
    type EmailIntegrationView,
    type EmailOAuthProvider,
} from "@/lib/integrations/email-oauth-types";

const GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/gmail.readonly",
];

const MICROSOFT_SCOPES = [
    "openid",
    "profile",
    "email",
    "offline_access",
    "User.Read",
    "Mail.Read",
];

const emailOAuthStateSchema = z.object({
    organizationId: z.string().min(1),
    organizationSlug: z.string().min(1),
    userId: z.string().min(1),
    provider: z.enum(EMAIL_OAUTH_PROVIDERS),
    issuedAt: z.string().min(1),
});

const emailOAuthConnectSchema = z.object({
    provider: z.enum(EMAIL_OAUTH_PROVIDERS).default("google"),
});

export type EmailOAuthState = z.infer<typeof emailOAuthStateSchema>;

export type EmailOAuthExchangeResult = {
    provider: EmailOAuthProvider;
    ownerEmail: string;
    accessToken: string;
    refreshToken: string | null;
    expiryAt: Date | null;
};

function resolveCallbackUrl(orgSlug: string): string {
    return new URL(`/api/org/${orgSlug}/email/callback`, `${getBaseUrl()}/`).toString();
}

function normalizeEmailAddress(value: string): string {
    return value.trim().toLowerCase();
}

type EmailIntegrationRow = {
    id: string;
    provider: string;
    status: string;
    ownerEmail: string;
    expiryAt: Date | null;
    lastSyncAt: Date | null;
    lastSyncStatus: string | null;
    lastSyncDurationMs: number | null;
    lastError: string | null;
    updatedAt: Date;
};

function toEmailIntegrationView(integration: EmailIntegrationRow): EmailIntegrationView {
    return {
        id: integration.id,
        provider: integration.provider as EmailOAuthProvider,
        status: integration.status,
        ownerEmail: integration.ownerEmail,
        expiryAt: integration.expiryAt ? integration.expiryAt.toISOString() : null,
        lastSyncAt: integration.lastSyncAt ? integration.lastSyncAt.toISOString() : null,
        lastSyncStatus: integration.lastSyncStatus,
        lastSyncDurationMs: integration.lastSyncDurationMs,
        lastError: integration.lastError,
        updatedAt: integration.updatedAt.toISOString(),
    };
}

async function selectEmailIntegrationView(organizationId: string): Promise<EmailIntegrationView | null> {
    const integration = await prisma.emailIntegration.findUnique({
        where: { organizationId },
        select: {
            id: true,
            provider: true,
            status: true,
            ownerEmail: true,
            expiryAt: true,
            lastSyncAt: true,
            lastSyncStatus: true,
            lastSyncDurationMs: true,
            lastError: true,
            updatedAt: true,
        },
    }) as EmailIntegrationRow | null;

    return integration ? toEmailIntegrationView(integration) : null;
}

export function parseEmailOAuthConnectInput(input: unknown): { provider: EmailOAuthProvider } {
    const parsed = emailOAuthConnectSchema.safeParse(input);
    if (!parsed.success) {
        throw badRequestError("INVALID_EMAIL_OAUTH_PROVIDER", parsed.error.flatten());
    }
    return parsed.data;
}

export function createEmailOAuthState(payload: Omit<EmailOAuthState, "issuedAt">): string {
    return encrypt(
        JSON.stringify({
            ...payload,
            issuedAt: new Date().toISOString(),
        }),
    );
}

export function parseEmailOAuthState(state: string): EmailOAuthState {
    try {
        const parsed = JSON.parse(decrypt(state)) as unknown;
        return emailOAuthStateSchema.parse(parsed);
    } catch {
        throw badRequestError("INVALID_OAUTH_STATE");
    }
}

export function isEmailOAuthProviderConfigured(provider: EmailOAuthProvider): boolean {
    if (provider === "google") {
        return Boolean(
            process.env.GOOGLE_CLIENT_ID?.trim() &&
            process.env.GOOGLE_CLIENT_SECRET?.trim(),
        );
    }

    return Boolean(
        process.env.MICROSOFT_CLIENT_ID?.trim() &&
        process.env.MICROSOFT_CLIENT_SECRET?.trim(),
    );
}

export function getEmailOAuthProviderLabel(provider: EmailOAuthProvider): string {
    return provider === "google" ? "Google Workspace" : "Microsoft 365";
}

function getGoogleOAuthClient(orgSlug: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
        throw failedDependencyError("EMAIL_OAUTH_NOT_CONFIGURED", {
            provider: "google",
            missing: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        });
    }

    return new google.auth.OAuth2(clientId, clientSecret, resolveCallbackUrl(orgSlug));
}

function getMicrosoftOAuthParams(orgSlug: string, state: string): URLSearchParams {
    const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
        throw failedDependencyError("EMAIL_OAUTH_NOT_CONFIGURED", {
            provider: "microsoft",
            missing: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
        });
    }

    const params = new URLSearchParams({
        client_id: clientId,
        response_type: "code",
        redirect_uri: resolveCallbackUrl(orgSlug),
        response_mode: "query",
        scope: MICROSOFT_SCOPES.join(" "),
        state,
        prompt: "consent",
    });

    return params;
}

export function buildEmailOAuthStartUrl(options: {
    provider: EmailOAuthProvider;
    state: string;
    orgSlug: string;
}): string {
    if (options.provider === "google") {
        const oauthClient = getGoogleOAuthClient(options.orgSlug);
        return oauthClient.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            include_granted_scopes: true,
            scope: GOOGLE_SCOPES,
            state: options.state,
        });
    }

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${getMicrosoftOAuthParams(options.orgSlug, options.state).toString()}`;
}

export async function exchangeEmailOAuthCode(options: {
    provider: EmailOAuthProvider;
    code: string;
    orgSlug: string;
}): Promise<EmailOAuthExchangeResult> {
    if (options.provider === "google") {
        return exchangeGoogleOAuthCode(options.code, options.orgSlug);
    }

    return exchangeMicrosoftOAuthCode(options.code, options.orgSlug);
}

async function exchangeGoogleOAuthCode(code: string, orgSlug: string): Promise<EmailOAuthExchangeResult> {
    const oauthClient = getGoogleOAuthClient(orgSlug);
    const { tokens } = await oauthClient.getToken(code);
    oauthClient.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauthClient });
    const userInfo = await oauth2.userinfo.get();
    const ownerEmail = userInfo.data.email?.trim();

    if (!ownerEmail) {
        throw failedDependencyError("EMAIL_OAUTH_PROFILE_LOOKUP_FAILED", {
            provider: "google",
            reason: "Missing user email in Google profile response",
        });
    }

    const accessToken = tokens.access_token?.trim();
    if (!accessToken) {
        throw failedDependencyError("EMAIL_OAUTH_TOKEN_EXCHANGE_FAILED", {
            provider: "google",
            reason: "Missing access token",
        });
    }

    return {
        provider: "google",
        ownerEmail: normalizeEmailAddress(ownerEmail),
        accessToken,
        refreshToken: tokens.refresh_token ?? null,
        expiryAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    };
}

async function exchangeMicrosoftOAuthCode(code: string, orgSlug: string): Promise<EmailOAuthExchangeResult> {
    const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
        throw failedDependencyError("EMAIL_OAUTH_NOT_CONFIGURED", {
            provider: "microsoft",
            missing: ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"],
        });
    }

    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "authorization_code",
            code,
            redirect_uri: resolveCallbackUrl(orgSlug),
            scope: MICROSOFT_SCOPES.join(" "),
        }).toString(),
    });

    if (!tokenResponse.ok) {
        throw failedDependencyError("EMAIL_OAUTH_TOKEN_EXCHANGE_FAILED", {
            provider: "microsoft",
            status: tokenResponse.status,
        });
    }

    const tokenData = await tokenResponse.json() as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
    };

    const accessToken = tokenData.access_token?.trim();
    if (!accessToken) {
        throw failedDependencyError("EMAIL_OAUTH_TOKEN_EXCHANGE_FAILED", {
            provider: "microsoft",
            reason: "Missing access token",
        });
    }

    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!profileResponse.ok) {
        throw failedDependencyError("EMAIL_OAUTH_PROFILE_LOOKUP_FAILED", {
            provider: "microsoft",
            status: profileResponse.status,
        });
    }

    const profile = await profileResponse.json() as {
        mail?: string;
        userPrincipalName?: string;
    };
    const ownerEmail = profile.mail?.trim() || profile.userPrincipalName?.trim();

    if (!ownerEmail) {
        throw failedDependencyError("EMAIL_OAUTH_PROFILE_LOOKUP_FAILED", {
            provider: "microsoft",
            reason: "Missing account email",
        });
    }

    return {
        provider: "microsoft",
        ownerEmail: normalizeEmailAddress(ownerEmail),
        accessToken,
        refreshToken: tokenData.refresh_token?.trim() || null,
        expiryAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
    };
}

export async function saveEmailOAuthIntegration(
    organizationId: string,
    result: EmailOAuthExchangeResult,
): Promise<EmailIntegrationView> {
    const existing = await prisma.emailIntegration.findUnique({
        where: { organizationId },
        select: {
            refreshTokenEncrypted: true,
            accessTokenEncrypted: true,
        },
    });

    const accessTokenEncrypted = encrypt(result.accessToken);
    const refreshTokenEncrypted = result.refreshToken
        ? encrypt(result.refreshToken)
        : existing?.refreshTokenEncrypted ?? null;

    const integration = await prisma.emailIntegration.upsert({
        where: { organizationId },
        create: {
            organizationId,
            provider: result.provider,
            status: "connected",
            ownerEmail: result.ownerEmail,
            accessTokenEncrypted,
            refreshTokenEncrypted,
            expiryAt: result.expiryAt,
            lastSyncAt: new Date(),
            lastError: null,
        },
        update: {
            provider: result.provider,
            status: "connected",
            ownerEmail: result.ownerEmail,
            accessTokenEncrypted,
            refreshTokenEncrypted,
            expiryAt: result.expiryAt,
            lastSyncAt: new Date(),
            lastError: null,
        },
        select: {
            id: true,
            provider: true,
            status: true,
            ownerEmail: true,
            expiryAt: true,
            lastSyncAt: true,
            lastSyncStatus: true,
            lastSyncDurationMs: true,
            lastError: true,
            updatedAt: true,
        },
    });

    logger.info("[Email OAuth] Integration saved", {
        orgId: organizationId,
        provider: result.provider,
    });
    void recordOnboardingEmailConnected(organizationId).catch(() => undefined);

    return toEmailIntegrationView(integration as EmailIntegrationRow);
}

async function revokeGoogleToken(token: string): Promise<void> {
    const revokeResponse = await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ token }).toString(),
    });

    if (!revokeResponse.ok) {
        throw new Error(`GOOGLE_TOKEN_REVOCATION_FAILED_${revokeResponse.status}`);
    }
}

function decryptMaybe(value: string | null | undefined): string | null {
    if (!value) return null;
    try {
        return decrypt(value);
    } catch {
        return null;
    }
}

export async function disconnectEmailIntegration(organizationId: string): Promise<EmailIntegrationView | null> {
    const existing = await prisma.emailIntegration.findUnique({
        where: { organizationId },
        select: {
            provider: true,
            accessTokenEncrypted: true,
            refreshTokenEncrypted: true,
        },
    });

    if (!existing) {
        return null;
    }

    const tokenForRevocation = decryptMaybe(existing.refreshTokenEncrypted) ?? decryptMaybe(existing.accessTokenEncrypted);

    if (existing.provider === "google" && tokenForRevocation) {
        try {
            await revokeGoogleToken(tokenForRevocation);
        } catch (error) {
            logger.warn("[Email OAuth] Google token revocation failed; clearing local state anyway", {
                orgId: organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    const integration = await prisma.emailIntegration.update({
        where: { organizationId },
        data: {
            status: "disconnected",
            accessTokenEncrypted: null,
            refreshTokenEncrypted: null,
            expiryAt: null,
            lastSyncAt: new Date(),
            lastError: null,
        },
        select: {
            id: true,
            provider: true,
            status: true,
            ownerEmail: true,
            expiryAt: true,
            lastSyncAt: true,
            lastSyncStatus: true,
            lastSyncDurationMs: true,
            lastError: true,
            updatedAt: true,
        },
    });

    return toEmailIntegrationView(integration as EmailIntegrationRow);
}

export async function getEmailIntegrationView(organizationId: string): Promise<EmailIntegrationView | null> {
    return selectEmailIntegrationView(organizationId);
}
