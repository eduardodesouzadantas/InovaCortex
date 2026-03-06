export function calculateSlaDueDate(orgId: string, createdAt: Date = new Date()): Date {
    // Basic implementation: 60 minutes SLA for all inbound open threads.
    // In the future, this can read from Organization.settingsJson or AppSettings
    const slaLimitMinutes = 60;

    const dueDate = new Date(createdAt.getTime());
    dueDate.setMinutes(dueDate.getMinutes() + slaLimitMinutes);

    return dueDate;
}
