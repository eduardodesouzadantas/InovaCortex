import { google } from "googleapis";

import { failedDependencyError } from "@/lib/http/route-errors";

import { type ProviderEmailRecord, extractEmailAddresses } from "../mapper";

const GOOGLE_EMAIL_SYNC_SCOPE = [
    "https://www.googleapis.com/auth/gmail.readonly",
];

type GoogleEmailSyncProvider = {
    provider: "google";
    fetchMessages: (input: { since: Date | null }) => Promise<ProviderEmailRecord[]>;
};

function decodeBase64Url(value: string): string {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function getHeaderValue(headers: Array<{ name?: string | null; value?: string | null }> | undefined, headerName: string): string | null {
    const header = headers?.find((entry) => entry.name?.toLowerCase() === headerName.toLowerCase());
    return header?.value?.trim() || null;
}

function stripHtmlTags(value: string): string {
    return value
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, "\"")
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, " ")
        .trim();
}

function collectBodyParts(part: any, target: { text: string | null; html: string | null }): void {
    if (!part) {
        return;
    }

    const mimeType = String(part.mimeType ?? "").toLowerCase();
    const data = typeof part.body?.data === "string" ? decodeBase64Url(part.body.data) : null;

    if (data && mimeType === "text/plain" && !target.text) {
        target.text = data;
    }

    if (data && mimeType === "text/html" && !target.html) {
        target.html = data;
    }

    for (const child of Array.isArray(part.parts) ? part.parts : []) {
        collectBodyParts(child, target);
    }

    if (data && !target.text && !target.html) {
        if (mimeType.includes("html")) {
            target.html = data;
        } else {
            target.text = data;
        }
    }
}

function getGoogleOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
        throw failedDependencyError("EMAIL_OAUTH_NOT_CONFIGURED", {
            provider: "google",
            missing: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        });
    }

    return new google.auth.OAuth2(clientId, clientSecret);
}

export function createGoogleEmailSyncProvider(input: {
    accessToken: string;
    refreshToken: string | null;
    expiryAt: Date | null;
}): GoogleEmailSyncProvider {
    const oauthClient = getGoogleOAuthClient();
    oauthClient.setCredentials({
        access_token: input.accessToken,
        refresh_token: input.refreshToken ?? undefined,
        expiry_date: input.expiryAt ? input.expiryAt.getTime() : undefined,
    });

    return {
        provider: "google",
        async fetchMessages(options: { since: Date | null }): Promise<ProviderEmailRecord[]> {
            const gmail = google.gmail({ version: "v1", auth: oauthClient });
            const messages: ProviderEmailRecord[] = [];
            const queryParts = ["in:anywhere", "-in:spam", "-in:trash"];

            if (options.since) {
                queryParts.push(`after:${Math.floor(options.since.getTime() / 1000)}`);
            }

            let pageToken: string | undefined;
            do {
                const response = await gmail.users.messages.list({
                    userId: "me",
                    q: queryParts.join(" "),
                    includeSpamTrash: false,
                    maxResults: 100,
                    pageToken,
                });

                pageToken = response.data.nextPageToken ?? undefined;
                const items = response.data.messages ?? [];

                for (const item of items) {
                    if (!item.id) {
                        continue;
                    }

                    const message = await gmail.users.messages.get({
                        userId: "me",
                        id: item.id,
                        format: "full",
                    });

                    const payload = message.data.payload;
                    if (!payload) {
                        continue;
                    }

                    const headers = payload.headers ?? [];
                    const subject = getHeaderValue(headers, "subject");
                    const fromHeader = getHeaderValue(headers, "from");
                    const toHeader = getHeaderValue(headers, "to");
                    const ccHeader = getHeaderValue(headers, "cc");
                    const bodyParts = { text: null as string | null, html: null as string | null };
                    collectBodyParts(payload, bodyParts);

                    const body = bodyParts.text
                        ?? (bodyParts.html ? stripHtmlTags(bodyParts.html) : null)
                        ?? message.data.snippet
                        ?? "";

                    const timestamp = message.data.internalDate
                        ? new Date(Number(message.data.internalDate))
                        : new Date();

                    const from = extractEmailAddresses(fromHeader ?? "")[0] ?? "";
                    const recipientHeaders = [toHeader, ccHeader].filter((value): value is string => Boolean(value));
                    const recipients = recipientHeaders.flatMap((value) => extractEmailAddresses(value));

                    if (!from || recipients.length === 0) {
                        continue;
                    }

                    messages.push({
                        threadExternalId: String(message.data.threadId ?? item.threadId ?? item.id),
                        messageExternalId: String(message.data.id ?? item.id),
                        subject,
                        from,
                        to: Array.from(new Set(recipients)).join(", "),
                        body,
                        bodyHtml: bodyParts.html,
                        timestamp,
                    });
                }
            } while (pageToken);

            return messages;
        },
    };
}
