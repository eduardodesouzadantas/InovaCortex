import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Contato",
    description: "Fale com nossos especialistas e descubra como a InovaCortex pode transformar sua operação com Inteligência Artificial.",
};

export default function ContatoLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
