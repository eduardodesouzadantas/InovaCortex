const MAX_EMAIL_BODY_LENGTH = 20_000;
const MAX_EMAIL_PREVIEW_LENGTH = 240;

export type ProviderEmailRecord = {
    threadExternalId: string;
    messageExternalId: string;
    subject: string | null;
    from: string;
    to: string;
    body: string;
    bodyHtml?: string | null;
    timestamp: Date;
};

export type DomainEmailRecord = ProviderEmailRecord & {
    bodyHtml: string | null;
    preview: string;
};

function sanitizeWhitespace(value: string): string {
    return value
        .replace(/\0/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function sanitizeHtml(value: string): string {
    return value
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/\son[a-z]+=("([^"]*)"|'([^']*)'|[^\s>]+)/gi, "")
        .replace(/\s?javascript:/gi, "");
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value;
    }

    return `${value.slice(0, maxLength - 1)}…`;
}

export function normalizeEmailAddress(value: string): string {
    return value.trim().toLowerCase();
}

export function extractEmailAddresses(value: string): string[] {
    const normalized = value
        .replace(/[\r\n]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalized) {
        return [];
    }

    const matches = normalized.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
    if (!matches) {
        return [normalizeEmailAddress(normalized)];
    }

    return Array.from(new Set(matches.map(normalizeEmailAddress)));
}

export function parseEmailAddressList(value: string): string[] {
    return value
        .split(",")
        .flatMap((entry) => extractEmailAddresses(entry))
        .filter(Boolean);
}

export function mapProviderEmailToDomain(email: ProviderEmailRecord): DomainEmailRecord {
    const body = sanitizeWhitespace(email.body).slice(0, MAX_EMAIL_BODY_LENGTH);
    const bodyHtml = typeof email.bodyHtml === "string" && email.bodyHtml.trim().length > 0
        ? sanitizeHtml(email.bodyHtml).slice(0, MAX_EMAIL_BODY_LENGTH)
        : null;

    return {
        ...email,
        from: extractEmailAddresses(email.from)[0] ?? normalizeEmailAddress(email.from),
        to: parseEmailAddressList(email.to).join(", "),
        body,
        bodyHtml,
        preview: truncate(body || bodyHtml || "(sem corpo)", MAX_EMAIL_PREVIEW_LENGTH),
    };
}
