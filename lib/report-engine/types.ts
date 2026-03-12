export interface BusinessMRIRoiData {
    operationalSavingsEstimate: number;
    revenueIncreaseEstimate: number;
    monthlyHoursRecovered: number;
    estimatedPaybackMonths: number;
    confidenceLevel: string;
    savingsRange?: string;
    revenueRange?: string;
    hoursRange?: string;
}

export interface BusinessMRIRoadmapItem {
    phase: string;
    title: string;
    description: string;
    owner?: string;
    eta?: string;
}

export interface BusinessMRIBlueprintData {
    modules: string[];
    integrations: string[];
    architectureNotes?: string[];
}

export interface BusinessMRIReportData {
    tenantId: string;
    reportId: string;
    companyName: string;
    generatedAt?: string | Date;
    classification: string;
    scoreTotal: number;
    summary: string;
    recommendedMissions: string[];
    pains: string[];
    risks: string[];
    roadmap: BusinessMRIRoadmapItem[];
    blueprint: BusinessMRIBlueprintData;
    roi: BusinessMRIRoiData;
}

export interface NormalizedBusinessMRIReportData {
    tenantId: string;
    reportId: string;
    companyName: string;
    generatedAtIso: string;
    generatedAtLabel: string;
    classification: string;
    scoreTotal: number;
    summary: string;
    recommendedMissions: string[];
    pains: string[];
    risks: string[];
    roadmap: BusinessMRIRoadmapItem[];
    blueprint: BusinessMRIBlueprintData;
    roi: BusinessMRIRoiData;
}

export interface ReportTemplateProps {
    data: NormalizedBusinessMRIReportData;
}
