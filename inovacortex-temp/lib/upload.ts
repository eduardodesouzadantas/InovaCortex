/**
 * lib/upload.ts
 * V19: File upload adapter — STUB (local filesystem) first, S3/R2 ready.
 *
 * Anti-chaos rule: Never crashes on missing cloud credentials.
 *   - LOCAL mode: saves to /public/uploads/{workspaceId}/{filename}
 *   - S3/R2 mode: activated when UPLOAD_S3_BUCKET + AWS_ACCESS_KEY_ID are set
 *
 * Usage:
 *   const result = await storeUpload({ orgId, workspaceId, type, file, filename });
 *   → result.url   (public URL)
 *   → result.stub  (true if saved locally)
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadType = "logo" | "brand" | "copy" | "credentials" | "other";

export interface StoreUploadInput {
    orgId: string;
    workspaceId: string;
    type: UploadType;
    filename: string;        // original filename from client
    buffer: Buffer;          // file bytes
    mimeType?: string;
}

export interface StoreUploadResult {
    id: string;
    url: string;
    filename: string;
    stub: boolean;
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function storeUpload(input: StoreUploadInput): Promise<StoreUploadResult> {
    const { orgId, workspaceId, type, filename, buffer, mimeType } = input;

    // Sanitize filename and generate a unique name to prevent collisions
    const ext = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "");
    const safeName = sanitizeFilename(path.basename(filename, ext));
    const uniqueName = `${safeName}-${crypto.randomBytes(4).toString("hex")}${ext}`;

    let url: string;
    let stub = false;

    if (isS3Enabled()) {
        url = await storeS3(workspaceId, uniqueName, buffer, mimeType);
    } else {
        url = await storeLocal(workspaceId, uniqueName, buffer);
        stub = true;
    }

    // Persist metadata to DB
    const record = await (prisma as any).workspaceUpload.create({
        data: {
            orgId,
            workspaceId,
            type,
            filename: uniqueName,
            url,
            sizeBytes: buffer.length,
        },
    });

    logger.info(`[UPLOAD] File stored${stub ? " (stub/local)" : " (S3)"}`, {
        id: record.id, workspaceId, type, filename: uniqueName, sizeBytes: buffer.length,
    });

    return { id: record.id, url, filename: uniqueName, stub };
}

// ─── Local STUB ───────────────────────────────────────────────────────────────

async function storeLocal(workspaceId: string, filename: string, buffer: Buffer): Promise<string> {
    const uploadDir = path.join(process.cwd(), "public", "uploads", workspaceId);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), buffer);
    return `/uploads/${workspaceId}/${filename}`;
}

// ─── S3/R2 Placeholder ────────────────────────────────────────────────────────

async function storeS3(workspaceId: string, filename: string, buffer: Buffer, mimeType?: string): Promise<string> {
    const client = new S3Client({
        region: process.env.AWS_REGION ?? "us-east-1",
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
        // For Cloudflare R2, override endpoint:
        ...(process.env.UPLOAD_S3_ENDPOINT ? { endpoint: process.env.UPLOAD_S3_ENDPOINT } : {}),
    });

    const bucket = process.env.UPLOAD_S3_BUCKET!;
    const key = `workspaces/${workspaceId}/${filename}`;

    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType ?? "application/octet-stream",
        // Make public readable (adjust for private-with-signed-URL if needed)
    }));

    const cdnBase = process.env.UPLOAD_CDN_URL ?? `https://${bucket}.s3.amazonaws.com`;
    return `${cdnBase}/${key}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isS3Enabled(): boolean {
    return !!(process.env.UPLOAD_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID);
}

function sanitizeFilename(name: string): string {
    return name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-_]/g, "")
        .slice(0, 60);
}
