"use client";

import dynamic from "next/dynamic";

export const ClientKanbanBoard = dynamic(
    () => import("@/app/admin/kanban-board").then((mod) => mod.KanbanBoard),
    { ssr: false }
);
