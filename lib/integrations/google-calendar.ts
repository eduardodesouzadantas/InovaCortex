/**
 * lib/integrations/google-calendar.ts
 * V16.2: Google Calendar + Meet integration service
 */

import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
];

function getOAuth2Client() {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
}

// ─── Token encryption (reuses encryption key from env) ─────────────────────
function encrypt(text: string): string {
    const key = Buffer.from(process.env.APP_ENCRYPTION_KEY || "fallback-32-chars-unsecure-key!!", "utf8").slice(0, 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(payload: string): string {
    const [ivHex, tagHex, dataHex] = payload.split(":");
    const key = Buffer.from(process.env.APP_ENCRYPTION_KEY || "fallback-32-chars-unsecure-key!!", "utf8").slice(0, 32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return decipher.update(Buffer.from(dataHex, "hex")).toString("utf8") + decipher.final("utf8");
}

// ─── Build a ready-to-use authenticated Google client for an org ────────────
export async function getGoogleClientForOrg(orgId: string) {
    const integration = await (prisma as any).calendarIntegration.findUnique({
        where: { organizationId: orgId }
    });

    if (!integration || integration.status !== "connected") {
        return null;
    }

    const oauth2Client = getOAuth2Client();

    const accessToken = integration.accessTokenEncrypted ? decrypt(integration.accessTokenEncrypted) : null;
    const refreshToken = integration.refreshTokenEncrypted ? decrypt(integration.refreshTokenEncrypted) : null;

    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
        expiry_date: integration.expiryAt ? new Date(integration.expiryAt).getTime() : undefined,
    });

    // Auto-refresh if token expired
    oauth2Client.on("tokens", async (tokens) => {
        const updateData: Record<string, any> = {};
        if (tokens.access_token) updateData.accessTokenEncrypted = encrypt(tokens.access_token);
        if (tokens.expiry_date) updateData.expiryAt = new Date(tokens.expiry_date);
        if (Object.keys(updateData).length > 0) {
            await (prisma as any).calendarIntegration.update({
                where: { organizationId: orgId },
                data: updateData
            });
        }
    });

    return { oauth2Client, calendarId: integration.calendarId || "primary" };
}

// ─── Create or update an event with a Meet link ────────────────────────────
export interface CalendarEventInput {
    calendarId: string;
    summary: string;
    description?: string;
    startAt: string;       // ISO string
    endAt: string;         // ISO string
    timezone: string;
    attendees?: string[];  // email list
    requestId: string;     // deterministic idempotency key
    googleEventId?: string; // if exists, UPDATE instead of CREATE
}

export async function createOrUpdateEventWithMeet(
    orgId: string,
    input: CalendarEventInput
): Promise<{ googleEventId: string; meetingUrl: string } | null> {
    const client = await getGoogleClientForOrg(orgId);
    if (!client) return null;

    const calendar = google.calendar({ version: "v3", auth: client.oauth2Client });

    const eventBody = {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.startAt, timeZone: input.timezone },
        end: { dateTime: input.endAt, timeZone: input.timezone },
        attendees: input.attendees?.map(e => ({ email: e })) ?? [],
        conferenceData: {
            createRequest: {
                requestId: input.requestId,
                conferenceSolutionKey: { type: "hangoutsMeet" }
            }
        }
    };

    try {
        let response;

        if (input.googleEventId) {
            // UPDATE existing event
            response = await calendar.events.patch({
                calendarId: input.calendarId,
                eventId: input.googleEventId,
                conferenceDataVersion: 1,
                requestBody: eventBody
            });
        } else {
            // CREATE new event
            response = await calendar.events.insert({
                calendarId: input.calendarId,
                conferenceDataVersion: 1,
                requestBody: eventBody
            });
        }

        const event = response.data;
        const meetingUrl = event.conferenceData?.entryPoints?.[0]?.uri
            ?? event.hangoutLink
            ?? "";

        return {
            googleEventId: event.id ?? "",
            meetingUrl
        };
    } catch (err: any) {
        // Log to CalendarIntegration.lastError but don't throw  
        await (prisma as any).calendarIntegration.update({
            where: { organizationId: orgId },
            data: { lastError: err.message, status: "error" }
        });
        return null;
    }
}

// ─── Build a Google OAuth consent URL ──────────────────────────────────────
export function getGoogleAuthUrl(state?: string): string {
    const oauth2Client = getOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
        state
    });
}

// ─── Exchange code for tokens + upsert CalendarIntegration ─────────────────
export async function exchangeGoogleCode(code: string, orgId: string) {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // Fetch the user's email
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const ownerEmail = userInfo.data.email ?? "";

    await (prisma as any).calendarIntegration.upsert({
        where: { organizationId: orgId },
        create: {
            organizationId: orgId,
            provider: "google",
            status: "connected",
            calendarId: "primary",
            ownerEmail,
            accessTokenEncrypted: tokens.access_token ? encrypt(tokens.access_token) : null,
            refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
            expiryAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
            lastError: null
        },
        update: {
            status: "connected",
            ownerEmail,
            accessTokenEncrypted: tokens.access_token ? encrypt(tokens.access_token) : undefined,
            refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
            expiryAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
            lastError: null
        }
    });

    return { ownerEmail };
}

// ─── Revoke + disconnect ────────────────────────────────────────────────────
export async function disconnectGoogleCalendar(orgId: string) {
    await (prisma as any).calendarIntegration.update({
        where: { organizationId: orgId },
        data: {
            status: "disconnected",
            accessTokenEncrypted: null,
            refreshTokenEncrypted: null,
            expiryAt: null,
            lastError: null
        }
    });
}
