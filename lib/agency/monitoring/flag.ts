export function isAgencyMonitoringNamespaceEnabled(): boolean {
    const raw = process.env.FF_AGENCY_MONITORING_NAMESPACE;
    if (typeof raw === "undefined") return true;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
