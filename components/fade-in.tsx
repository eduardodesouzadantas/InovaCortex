"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

interface FadeInProps {
    children: ReactNode;
    delay?: number;
    direction?: "up" | "down" | "left" | "right" | "none";
    className?: string;
}

export function FadeIn({
    children,
    delay = 0,
    direction = "up",
    className = "",
}: FadeInProps) {
    const [isVisible, setIsVisible] = useState(false);
    const domRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Se estiver em modo PDF, força a viabilidade para não depender de scroll
        if (typeof window !== "undefined" && window.location.search.includes("pdf=true")) {
            setIsVisible(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setIsVisible(true);
                    if (domRef.current) observer.unobserve(domRef.current);
                }
            },
            { threshold: 0, rootMargin: "0px 0px 100px 0px" }
        );

        if (domRef.current) {
            observer.observe(domRef.current);
        }

        return () => {
            if (domRef.current) observer.unobserve(domRef.current);
        };
    }, []);

    const directionClasses = {
        up: "translate-y-8",
        down: "-translate-y-8",
        left: "translate-x-8",
        right: "-translate-x-8",
        none: "",
    };

    // Em modo PDF, desabilita transições para que o puppeteer capture instantaneamente
    const isPdf = typeof window !== "undefined" && window.location.search.includes("pdf=true");

    return (
        <div
            ref={domRef}
            className={`${isPdf ? "" : "transition-all duration-1000 ease-out"} ${isVisible ? "opacity-100 transform-none" : `opacity-0 ${directionClasses[direction]}`
                } ${className}`}
            style={isPdf ? {} : { transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}
