import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Soluções",
    description: "Explore nosso ecossistema de soluções empresariais: Agentes de IA, Desenvolvimento SaaS, Dashboards interativos e Automação extrema.",
};

export default function SolucoesLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
