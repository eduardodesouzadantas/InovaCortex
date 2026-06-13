"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";
import { resolveLoginErrorMessage } from "@/lib/auth/login-error-message";

type LoginResponseBody = {
    error?: string;
    code?: string;
    success?: boolean;
};

export default function LegacyAdminLoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await fetch("/api/admin/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            if (res.ok) {
                router.push("/admin");
                router.refresh();
            } else {
                const data = (await res.json()) as LoginResponseBody;
                setError(resolveLoginErrorMessage(data));
            }
        } catch {
            setError("Erro de conexão");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-muted/10 flex items-center justify-center pt-20">
            <div className="max-w-md w-full glass-panel p-8 rounded-2xl border border-primary/20 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-primary" />
                <Shield className="w-12 h-12 text-primary mx-auto mb-6" />
                <h2 className="text-2xl font-bold mb-2">Restrito</h2>
                <p className="text-muted-foreground text-sm mb-6">Mission Control Admin Area</p>

                <form onSubmit={handleLogin} className="space-y-4">
                    <input
                        type="email"
                        placeholder="E-mail de Acesso..."
                        value={email}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                        required
                        className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-center text-base"
                    />
                    <input
                        type="password"
                        placeholder="Senha de Acesso..."
                        value={password}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                        required
                        className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-center tracking-widest text-lg"
                    />
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <Button type="submit" className="w-full h-12" disabled={loading}>
                        {loading ? "Verificando..." : "Autenticar"}
                    </Button>
                </form>
            </div>
        </div>
    );
}
