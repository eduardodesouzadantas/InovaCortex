"use client";

import { useState, useEffect } from 'react';

export function useLearningMode() {
    const [learningMode, setLearningMode] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('learningMode');
        if (stored) setLearningMode(stored === 'true');
    }, []);

    const toggleLearningMode = () => {
        setLearningMode(prev => {
            const next = !prev;
            localStorage.setItem('learningMode', String(next));
            return next;
        });
    };

    return {
        userSettings: { learningMode },
        toggleLearningMode
    };
}
