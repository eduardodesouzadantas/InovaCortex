/**
 * lib/auth/rbac.ts
 * Role-Based Access Control for V9 multi-tenant system.
 *
 * Role hierarchy: owner > admin > closer > viewer
 */

export type Role = "owner" | "admin" | "closer" | "viewer";

// Ordered from least to most privileged
const ROLE_RANK: Record<Role, number> = {
    viewer: 1,
    closer: 2,
    admin: 3,
    owner: 4,
};

/**
 * Returns true if `userRole` has at least the same privilege as `requiredRole`.
 */
export function hasRole(userRole: Role | string, requiredRole: Role): boolean {
    const userRank = ROLE_RANK[userRole as Role] ?? 0;
    const requiredRank = ROLE_RANK[requiredRole] ?? 99;
    return userRank >= requiredRank;
}

/**
 * Route-level permission checks.
 * Throws an error if the user doesn't have the required role.
 */
export function assertRole(userRole: Role | string, requiredRole: Role): void {
    if (!hasRole(userRole, requiredRole)) {
        throw new Error(`FORBIDDEN: requires role '${requiredRole}', got '${userRole}'`);
    }
}

// ─── Route Permission Map ─────────────────────────────────────────────────────

export const ROUTE_PERMISSIONS = {
    // Read-only
    viewDashboard: "viewer" as Role,
    viewLeadDetail: "viewer" as Role,
    viewDossier: "viewer" as Role,
    viewROI: "viewer" as Role,

    // Closer actions
    generateProposal: "closer" as Role,
    updateNotes: "closer" as Role,
    updateLeadStatus: "closer" as Role,

    // Admin actions
    generatePresales: "admin" as Role,
    manageSettings: "admin" as Role,
    sendWhatsApp: "admin" as Role,

    // Owner only
    deleteData: "owner" as Role,
    manageUsers: "owner" as Role,
    changePlan: "owner" as Role,
} as const;

export type Permission = keyof typeof ROUTE_PERMISSIONS;

export function can(userRole: Role | string, permission: Permission): boolean {
    return hasRole(userRole, ROUTE_PERMISSIONS[permission]);
}
