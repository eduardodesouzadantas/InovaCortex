export const EMAIL_OAUTH_PROVIDERS = ["google", "microsoft"] as const;
export type EmailOAuthProvider = (typeof EMAIL_OAUTH_PROVIDERS)[number];

export type EmailIntegrationView = {
    id: string;
    provider: EmailOAuthProvider;
    status: string;
    ownerEmail: string;
    expiryAt: string | null;
    lastSyncAt: string | null;
    lastSyncStatus: string | null;
    lastSyncDurationMs: number | null;
    lastError: string | null;
    updatedAt: string;
};

export function getEmailOAuthProviderLabel(provider: EmailOAuthProvider): string {
    return provider === "google" ? "Google Workspace" : "Microsoft 365";
}
