"use client";

const STATUS_STYLES: Record<string, string> = {
    draft: "bg-gray-400/10   border-gray-400/20   text-gray-400",
    reviewed: "bg-blue-400/10   border-blue-400/20   text-blue-400",
    approved: "bg-green-500/10  border-green-500/20  text-green-500",
    scheduled: "bg-purple-400/10 border-purple-400/20 text-purple-400",
    posted: "bg-yellow-400/10 border-yellow-400/20 text-yellow-400",
};

const STATUS_LABELS: Record<string, string> = {
    draft: "Rascunho",
    reviewed: "Revisado",
    approved: "Aprovado",
    scheduled: "Agendado",
    posted: "Postado",
};

export function ContentStatusBadge({ status }: { status: string }) {
    const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
    return (
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${style}`}>
            {STATUS_LABELS[status] ?? status}
        </span>
    );
}
