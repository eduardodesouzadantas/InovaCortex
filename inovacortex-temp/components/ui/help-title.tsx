"use client"

import { HelpPopover } from "@/components/ui/help-popover"
import { getHelp } from "@/lib/help/use-help"
import { HelpTopic } from "@/lib/help/help-content"

export function HelpTitle({ label, helpKey, className = "" }: { label: string, helpKey: HelpTopic, className?: string }) {
    const help = getHelp(helpKey)
    return (
        <div className={`flex items-center gap-1.5 ${className}`}>
            <span>{label}</span>
            <HelpPopover {...help} />
        </div>
    )
}
