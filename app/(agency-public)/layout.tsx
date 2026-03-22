import type { ReactNode } from "react";

export default function AgencyPublicLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <main className="min-h-screen bg-[#07111d] text-white">
            {children}
        </main>
    );
}
