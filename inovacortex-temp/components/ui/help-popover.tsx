"use client"

import { HelpCircle } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useLearningMode } from "@/lib/help/use-learning-mode"
import { isLearningModeEnabled } from "@/lib/help/learning-mode"

interface HelpPopoverProps {
    title: string
    description: string
    benchmark?: string
    actions?: string[]
}

export function HelpPopover({
    title,
    description,
    benchmark,
    actions
}: HelpPopoverProps) {
    const { userSettings } = useLearningMode();
    const learningMode = isLearningModeEnabled(userSettings);

    return (
        <Popover>

            <PopoverTrigger asChild>
                <HelpCircle className="h-4 w-4 ml-1 text-muted-foreground cursor-pointer hover:text-primary transition-colors" />
            </PopoverTrigger>

            <PopoverContent className="w-80 space-y-3 text-sm bg-background border-border shadow-2xl z-[100]">

                <p className="font-semibold text-foreground">{title}</p>

                <p className={`text-muted-foreground leading-relaxed ${learningMode ? "text-sm" : "text-xs max-h-12 overflow-hidden text-ellipsis line-clamp-2"}`}>
                    {description}
                </p>

                {benchmark && (
                    <div className="p-2 bg-primary/5 rounded border border-primary/10">
                        <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Benchmark</p>
                        <p className="text-foreground/90">{benchmark}</p>
                    </div>
                )}

                {learningMode && actions && (
                    <div className="space-y-2 mt-4 pt-3 border-t border-border">
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ações Recomendadas (Aprofundamento)</p>
                        <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                            {actions.map((a, i) => (
                                <li key={i}>{a}</li>
                            ))}
                        </ul>
                    </div>
                )}

            </PopoverContent>

        </Popover>
    )
}
