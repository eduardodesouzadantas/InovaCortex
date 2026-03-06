"use client"

import { useState } from "react"
import { GuideLauncher } from "@/components/product-guide/guide-launcher"
import { ProductWalkthrough } from "@/components/product-guide/walkthrough"

/**
 * CockpitGuideBar — injected into the Server Component cockpit page.
 * Renders GuideLauncher + ProductWalkthrough for the commandCenter guide.
 */
export function CockpitGuideBar() {
    const [forceStart, setForceStart] = useState(false)

    return (
        <>
            <ProductWalkthrough
                guide="commandCenter"
                forceStart={forceStart}
                onClose={() => setForceStart(false)}
            />
            <GuideLauncher
                guideKey="commandCenter"
                onStartGuide={() => setForceStart(true)}
            />
        </>
    )
}
