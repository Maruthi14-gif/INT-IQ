import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Keep the dev badge away from the sidebar's user menu (bottom-left).
  devIndicators: { position: "bottom-right" },
  partialPrefetching: true,
  // There is no marketing home page: the site opens on sign-in.
  async redirects() {
    return [{ source: "/", destination: "/sign-in", permanent: false }]
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
