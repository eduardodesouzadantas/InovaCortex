import { ImageResponse } from "next/og";
import { Inter } from "next/font/google";

export const runtime = "edge";

// Image metadata
export const alt = "InovaCortex - Agentes Autônomos de Inteligência Artificial";
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = "image/png";

export default function Image() {
    return new ImageResponse(
        (
            <div
                style={{
                    background: "linear-gradient(to bottom right, #09090b, #121214, #001026)",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "Inter, sans-serif",
                    padding: "40px",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                        height: "100%",
                        border: "2px solid rgba(14, 165, 233, 0.2)",
                        borderRadius: "40px",
                        background: "rgba(0, 0, 0, 0.4)",
                        flexDirection: "column",
                        position: "relative",
                    }}
                >
                    {/* Logo / Title Area */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "40px" }}>
                        <h1
                            style={{
                                fontSize: "80px",
                                fontWeight: 900,
                                color: "#ffffff",
                                letterSpacing: "-0.05em",
                                margin: 0,
                                marginBottom: "20px",
                                display: "flex",
                            }}
                        >
                            Inova<span style={{ color: "#8b5cf6" }}>Cortex</span>
                        </h1>
                    </div>

                    {/* Subtitle / Description */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "20px",
                        }}
                    >
                        <p
                            style={{
                                fontSize: "42px",
                                fontWeight: 600,
                                color: "#f8fafc",
                                margin: 0,
                                textAlign: "center",
                                maxWidth: "900px",
                                lineHeight: 1.4,
                            }}
                        >
                            Inteligência Artificial Direta e Escalável.
                        </p>
                        <p
                            style={{
                                fontSize: "28px",
                                fontWeight: 400,
                                color: "#94a3b8",
                                margin: 0,
                                textAlign: "center",
                                maxWidth: "800px",
                            }}
                        >
                            Agentes Autônomos • Desenvolvimento SaaS • Automação
                        </p>
                    </div>

                    {/* Decorative Elements */}
                    <div
                        style={{
                            position: "absolute",
                            top: "-200px",
                            left: "-200px",
                            width: "600px",
                            height: "600px",
                            background: "rgba(14, 165, 233, 0.15)",
                            filter: "blur(100px)",
                            borderRadius: "50%",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            bottom: "-200px",
                            right: "-200px",
                            width: "600px",
                            height: "600px",
                            background: "rgba(139, 92, 246, 0.15)",
                            filter: "blur(100px)",
                            borderRadius: "50%",
                        }}
                    />
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
