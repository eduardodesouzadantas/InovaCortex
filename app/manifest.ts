import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "InovaCortex Mobile Command Surface",
        short_name: "InovaCortex",
        description: "Mobile-first command surface for the InovaCortex platform.",
        start_url: "/mobile",
        scope: "/",
        display: "standalone",
        background_color: "#050816",
        theme_color: "#050816",
        icons: [
            {
                src: "/favicon.ico",
                sizes: "any",
                type: "image/x-icon",
            },
        ],
    };
}

