"use client"

import { HelpCircle, RefreshCw } from "lucide-react"
import { useLearningMode } from "@/lib/help/use-learning-mode"
import { isLearningModeEnabled } from "@/lib/help/learning-mode"

interface Props {
    guideKey: string;
    onStartGuide: () => void;
}

export function GuideLauncher({ guideKey, onStartGuide }: Props) {
    const { userSettings, toggleLearningMode } = useLearningMode()

    const handleReset = () => {
        localStorage.removeItem(`guide_seen_${guideKey}`)
        localStorage.removeItem("hasSeenOnboarding") // also clear legacy fallback
        onStartGuide()
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={toggleLearningMode}
                className={`p-1.5 border rounded-lg transition-colors flex items-center justify-center text-[10px] font-bold ${isLearningModeEnabled(userSettings)
                        ? "bg-[#d4af37]/20 border-[#d4af37]/50 text-[#d4af37]"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                    }`}
                title="Toggle Learning Mode"
            >
                LM {isLearningModeEnabled(userSettings) ? "ON" : "OFF"}
            </button>

            <button
                onClick={onStartGuide}
                className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-1.5 text-[10px] font-bold text-white/80"
            >
                <HelpCircle className="w-3.5 h-3.5 text-[#d4af37]" />
                Guia Completo
            </button>

            <button
                onClick={handleReset}
                className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center"
                title="Reset Tutorial"
            >
                <RefreshCw className="w-3.5 h-3.5 text-white/40 hover:text-white/80" />
            </button>
        </div>
    )
}
