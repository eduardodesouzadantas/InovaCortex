"use client"

import { useEffect, useState } from "react"
import { PRODUCT_GUIDES } from "./guide-engine"

export function GuideVerifier({ guideKey }: { guideKey: keyof typeof PRODUCT_GUIDES }) {
    const [missing, setMissing] = useState<string[]>([])

    useEffect(() => {
        if (process.env.NODE_ENV === "production" || !guideKey) return

        // Give DOM a tick to flush UI
        const timer = setTimeout(() => {
            const guideSteps = PRODUCT_GUIDES[guideKey]
            if (!guideSteps) return

            const notFound = guideSteps.filter(step => {
                // Joyride requires target to be an HTML element or a valid CSS selector string
                if (typeof step.target === 'string') {
                    return !document.querySelector(step.target)
                }
                return false
            }).map(s => String(s.target))

            setMissing(notFound)
        }, 1500)

        return () => clearTimeout(timer)
    }, [guideKey])

    if (process.env.NODE_ENV === "production" || missing.length === 0) {
        return null
    }

    return (
        <div className="fixed bottom-4 right-4 z-[9999] bg-red-900 border border-red-500 rounded-lg p-4 max-w-sm shadow-2xl">
            <h4 className="text-white font-bold text-sm mb-2 flex items-center gap-2">
                ⚠️ Missing Walkthrough Targets ({guideKey})
            </h4>
            <p className="text-red-200 text-xs mb-2">
                The following `data-guide-id` elements were not found in the DOM:
            </p>
            <ul className="text-xs text-white bg-black/50 rounded-md p-2 font-mono flex flex-col gap-1">
                {missing.map(m => (
                    <li key={m}>❌ {m}</li>
                ))}
            </ul>
        </div>
    )
}
