import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export interface StoreDossierPdfInput {
    organizationId: string;
    slug: string;
    filename: string;
    buffer: Buffer;
}

export interface StoreDossierPdfResult {
    url: string;
    storageKey: string;
    stub: boolean;
    inlineBase64?: string;
}

export async function storeDossierPdf(input: StoreDossierPdfInput): Promise<StoreDossierPdfResult> {
    if (isS3Enabled()) {
        const result = await storeInS3(input);
        return { ...result, stub: false };
    }

    if (process.env.NODE_ENV === "production") {
        const result = await storeInlineForApi(input);
        return { ...result, stub: true };
    }

    const result = await storeLocally(input);
    return { ...result, stub: true };
}

async function storeLocally(input: StoreDossierPdfInput): Promise<Omit<StoreDossierPdfResult, "stub">> {
    const safeFilename = sanitizeFilename(input.filename);
    const relativeDir = path.join("reports", sanitizeFilename(input.slug));
    const absoluteDir = path.join(process.cwd(), "public", relativeDir);
    await mkdir(absoluteDir, { recursive: true });

    const absoluteFile = path.join(absoluteDir, safeFilename);
    await writeFile(absoluteFile, input.buffer);

    return {
        url: `/${path.posix.join("reports", sanitizeFilename(input.slug), safeFilename)}`,
        storageKey: path.posix.join("local", relativeDir.replace(/\\/g, "/"), safeFilename),
    };
}

async function storeInS3(input: StoreDossierPdfInput): Promise<Omit<StoreDossierPdfResult, "stub">> {
    const bucket = getBucketName();
    const endpoint = process.env.PDF_STORAGE_S3_ENDPOINT ?? process.env.UPLOAD_S3_ENDPOINT;
    const key = [
        "reports",
        sanitizeFilename(input.organizationId),
        sanitizeFilename(input.slug),
        `${Date.now()}-${sanitizeFilename(input.filename)}`,
    ].join("/");

    const client = new S3Client({
        region: process.env.PDF_STORAGE_AWS_REGION ?? process.env.AWS_REGION ?? "us-east-1",
        credentials: {
            accessKeyId: getAccessKeyId(),
            secretAccessKey: getSecretAccessKey(),
        },
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });

    await client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: input.buffer,
            ContentType: "application/pdf",
            ContentDisposition: `attachment; filename="${sanitizeFilename(input.filename)}"`,
            CacheControl: "public, max-age=31536000, immutable",
        })
    );

    const cdnBase =
        process.env.PDF_STORAGE_CDN_URL ??
        process.env.UPLOAD_CDN_URL ??
        `https://${bucket}.s3.amazonaws.com`;

    return {
        url: `${cdnBase.replace(/\/$/, "")}/${key}`,
        storageKey: key,
    };
}

async function storeInlineForApi(input: StoreDossierPdfInput): Promise<Omit<StoreDossierPdfResult, "stub">> {
    const safeSlug = sanitizeFilename(input.slug);
    const safeFilename = sanitizeFilename(input.filename) || "dossie.pdf";

    return {
        url: `/api/pdf/${encodeURIComponent(safeSlug)}?mode=file`,
        storageKey: path.posix.join(
            "inline",
            sanitizeFilename(input.organizationId),
            safeSlug,
            `${Date.now()}-${safeFilename}`
        ),
        inlineBase64: input.buffer.toString("base64"),
    };
}

function isS3Enabled(): boolean {
    return Boolean(getBucketName() && getAccessKeyId() && getSecretAccessKey());
}

function getBucketName(): string {
    return (process.env.PDF_STORAGE_S3_BUCKET ?? process.env.UPLOAD_S3_BUCKET ?? "").trim();
}

function getAccessKeyId(): string {
    return (process.env.PDF_STORAGE_AWS_ACCESS_KEY_ID ?? process.env.AWS_ACCESS_KEY_ID ?? "").trim();
}

function getSecretAccessKey(): string {
    return (process.env.PDF_STORAGE_AWS_SECRET_ACCESS_KEY ?? process.env.AWS_SECRET_ACCESS_KEY ?? "").trim();
}

function sanitizeFilename(input: string): string {
    return input
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-_.]/g, "")
        .slice(0, 120);
}

