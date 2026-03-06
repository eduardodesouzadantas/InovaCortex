"use client"

import { useEffect, useState } from "react"
import Joyride, { CallBackProps, STATUS } from "react-joyride"
import { PRODUCT_GUIDES } from "./guide-engine"
import { useLearningMode } from "@/lib/help/use-learning-mode"
import { isLearningModeEnabled } from "@/lib/help/learning-mode"
import { GuideVerifier } from "./guide-verifier"

interface Props {
    guide: keyof typeof PRODUCT_GUIDES;
    forceStart?: boolean;
    onClose?: () => void;
}

export function ProductWalkthrough({ guide, forceStart, onClose }: Props) {
    const steps = PRODUCT_GUIDES[guide]
    const [run, setRun] = useState(false)
    const { userSettings } = useLearningMode()

    useEffect(() => {
        if (forceStart) {
            setRun(true)
            return
        }

        const key = `guide_seen_${guide}`
        const hasSeen = localStorage.getItem(key)

        if (!hasSeen && isLearningModeEnabled(userSettings)) {
            setRun(true)
        }
    }, [userSettings, guide, forceStart])

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED]
        if (finishedStatuses.includes(status)) {
            setRun(false)
            localStorage.setItem(`guide_seen_${guide}`, "1")
            onClose?.()
        }
    }

    return (
        <>
            <GuideVerifier guideKey={guide} />
            <Joyride
                steps={steps}
                run={run}
                continuous
                showProgress
                showSkipButton
                callback={handleJoyrideCallback}
                styles={{
                    options: {
                        primaryColor: "#FFD700"
                    }
                }}
            />
        </>
    )
}
