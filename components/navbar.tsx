import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui/button";

export function Navbar() {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 md:px-8 mx-auto">
                <Link href="/" className="flex items-center space-x-2">
                    <span className="font-bold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">InovaCortex</span>
                </Link>
                <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
                    <Link href="/solucoes" className="transition-colors hover:text-foreground text-foreground/70">Soluções</Link>
                    <Link href="/cases" className="transition-colors hover:text-foreground text-foreground/70">Cases</Link>
                    <Link href="/sobre" className="transition-colors hover:text-foreground text-foreground/70">Sobre</Link>
                </nav>
                <div className="flex items-center space-x-4">
                    <ThemeToggle />
                    <Link href="/avaliacao" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 hidden md:inline-flex">
                        Fazer Avaliação
                    </Link>
                </div>
            </div>
        </header>
    );
}
