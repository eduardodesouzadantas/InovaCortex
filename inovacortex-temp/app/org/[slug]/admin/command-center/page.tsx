"use client";

/**
 * app/org/[slug]/admin/command-center/page.tsx
 * CEO Command Center — Ultra-Premium Executive Dashboard
 *
 * Stack: Next.js 14 + TypeScript + TailwindCSS + Framer Motion + Recharts
 * Design: Dark mode, gold accents (#d4af37), glassmorphism, smooth animations
 */

import { CommandCenter } from "./command-center-client";

export default function CommandCenterPage({ params }: { params: { slug: string } }) {
    return <CommandCenter orgSlug={params.slug} />;
}
