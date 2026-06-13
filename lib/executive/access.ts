import { hasRole, type Role } from "@/lib/auth/rbac";
import type { AuthContext } from "@/lib/auth/session";

export type ExecutiveAccessReason =
    | "UNAUTHENTICATED"
    | "FORBIDDEN"
    | "TENANT_MISMATCH"
    | "WRONG_SCOPE";

export type ExecutiveGuardResult =
    | { state: "authorized" }
    | { state: "redirect"; reason: ExecutiveAccessReason; redirectTo: string }
    | { state: "forbidden"; reason: "FORBIDDEN" };

export function canAccessExecutiveSurface(role: Role | string | null | undefined): boolean {
    return typeof role === "string" && hasRole(role, "admin");
}

export function resolveExecutiveSurfacePath(orgSlug: string): string {
    return `/org/${orgSlug}/executive`;
}

export function resolveExecutiveLoginPath(orgSlug: string): string {
    return `${resolveExecutiveSurfacePath(orgSlug)}/login`;
}

export function resolveTenantAdminPath(orgSlug: string): string {
    return `/org/${orgSlug}/admin`;
}

export function resolveAgencyConsolePath(): string {
    return "/agency";
}

export function resolvePostLoginPath(input: {
    orgSlug: string;
    role: Role | string;
    requestedSurface: "admin" | "executive";
}): string {
    if (input.requestedSurface === "executive" && canAccessExecutiveSurface(input.role)) {
        return resolveExecutiveSurfacePath(input.orgSlug);
    }

    return resolveTenantAdminPath(input.orgSlug);
}

export function getExecutiveLoginErrorMessage(reason: string | null): string | null {
    switch (reason) {
        case "UNAUTHENTICATED":
            return "Sua sessao expirou. Faca login novamente para acessar o modo executivo.";
        case "FORBIDDEN":
            return "Sua conta nao tem acesso ao modo executivo. Use o console operacional ou peca elevacao de perfil.";
        case "TENANT_MISMATCH":
            return "A sessao atual pertence a outra empresa. Entre novamente no tenant correto.";
        case "WRONG_SCOPE":
            return "Esta conta esta no modo agency. Saia da sessao atual e entre no tenant executivo correto.";
        default:
            return null;
    }
}

export function evaluateExecutiveSurfaceAccess(auth: AuthContext, requestedSlug: string): ExecutiveGuardResult {
    if (!auth.isAuthenticated) {
        return {
            state: "redirect",
            reason: "UNAUTHENTICATED",
            redirectTo: `${resolveExecutiveLoginPath(requestedSlug)}?reason=UNAUTHENTICATED`,
        };
    }

    if (auth.authScope !== "tenant") {
        return {
            state: "redirect",
            reason: "WRONG_SCOPE",
            redirectTo: resolveAgencyConsolePath(),
        };
    }

    if (!auth.organizationSlug || auth.organizationSlug !== requestedSlug) {
        return {
            state: "redirect",
            reason: "TENANT_MISMATCH",
            redirectTo: auth.organizationSlug
                ? resolvePostLoginPath({
                    orgSlug: auth.organizationSlug,
                    role: auth.role ?? "viewer",
                    requestedSurface: canAccessExecutiveSurface(auth.role) ? "executive" : "admin",
                })
                : `${resolveExecutiveLoginPath(requestedSlug)}?reason=TENANT_MISMATCH`,
        };
    }

    if (!canAccessExecutiveSurface(auth.role)) {
        return {
            state: "forbidden",
            reason: "FORBIDDEN",
        };
    }

    return { state: "authorized" };
}
