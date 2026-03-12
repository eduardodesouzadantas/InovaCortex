# InovaCortex Report Engine

Server-side PDF report pipeline for AI Business MRI reports.

Flow:

`diagnostic data -> renderBusinessMRIHtml -> generatePdfFromHtml -> Buffer`

Main API:

```ts
import { generateBusinessMRIReport } from "@/lib/report-engine/generate-report";

const pdfBuffer = await generateBusinessMRIReport({
  tenantId: "org_123",
  reportId: "rep_456",
  companyName: "Empresa XPTO",
  classification: "Alta prioridade",
  scoreTotal: 78,
  summary: "Resumo executivo...",
  recommendedMissions: ["Automacao comercial"],
  pains: ["Retrabalho manual"],
  risks: ["Dados inconsistentes"],
  roadmap: [],
  blueprint: { modules: ["CRM"], integrations: ["WhatsApp"] },
  roi: {
    operationalSavingsEstimate: 35000,
    revenueIncreaseEstimate: 22000,
    monthlyHoursRecovered: 140,
    estimatedPaybackMonths: 2.1,
    confidenceLevel: "Alta",
  },
});
```
