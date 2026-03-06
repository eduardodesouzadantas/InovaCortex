export const GUIDE_IDS = {
    // Command Center
    cc_kpi_revenue: "cc_kpi_revenue",
    cc_kpi_pipeline: "cc_kpi_pipeline",
    cc_kpi_leaks: "cc_kpi_leaks",
    cc_activity_feed: "cc_activity_feed",

    // AI Room
    ai_input: "ai_input",
    ai_quick_tiles: "ai_quick_tiles",
    ai_revenue_brain: "ai_revenue_brain",
    ai_action_engine: "ai_action_engine",

    // WhatsApp CRM
    wa_inbox_list: "wa_inbox_list",
    wa_chat_pane: "wa_chat_pane",
    wa_compose_box: "wa_compose_box",
    wa_campaigns_tab: "wa_campaigns_tab",
    wa_team_tab: "wa_team_tab",

    // Performance
    perf_kpi_strip: "perf_kpi_strip",
    perf_leaderboard: "perf_leaderboard",
    perf_sla_panel: "perf_sla_panel",
} as const;

export type GuideId = typeof GUIDE_IDS[keyof typeof GUIDE_IDS];
