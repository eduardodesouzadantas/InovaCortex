import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Blog & Insights | InovaCortex",
    description: "Artigos técnicos e estudos de arquitetura sobre inteligência operacional.",
};

export default function BlogLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
