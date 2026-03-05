export function calculateMeetingScore(assessment: any, roi: any): { potentialRevenue: number; closeProbability: number; priorityTier: string } {
    let score = 0;

    // Stub logic: Using default values for now, but in real scenario, we'll extract these from 'assessment' and 'roi' args.
    const companySize = assessment.headcount || "11-50";
    const isB2B = assessment.audience === "B2B";
    const painLevel = assessment.painLevel || "high";
    const estimatedSavings = roi?.calculatedSavings || 50000;

    // Headcount logic
    if (companySize === "100+") score += 40;
    else if (companySize === "51-100") score += 30;
    else if (companySize === "11-50") score += 20;
    else score += 10;

    // B2B 
    if (isB2B) score += 20;

    // ROI potential
    if (estimatedSavings > 100000) score += 30;
    else if (estimatedSavings > 50000) score += 20;
    else score += 10;

    // Pain level
    if (painLevel === "critical") score += 20;
    else if (painLevel === "high") score += 10;

    let priorityTier = "cold";
    if (score >= 80) priorityTier = "hot";
    else if (score >= 50) priorityTier = "warm";

    // Mock calculations
    const potentialRevenue = estimatedSavings * 0.1; // 10% of savings
    const closeProbability = Math.min(score, 99) / 100;

    return {
        potentialRevenue,
        closeProbability,
        priorityTier
    };
}
