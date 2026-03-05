export default function sitemap() {
    const baseUrl = "https://inovacortex.com";

    // Páginas principais
    const routes = ["", "/solucoes", "/cases", "/sobre", "/contato"].map(
        (route) => ({
            url: `${baseUrl}${route}`,
            lastModified: new Date().toISOString(),
            changeFrequency: "weekly" as const,
            priority: route === "" ? 1 : 0.8,
        })
    );

    return [...routes];
}
