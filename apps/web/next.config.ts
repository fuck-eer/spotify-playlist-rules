import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rulemix/rules-engine", "@rulemix/spotify"],
  // Workspace packages ship TS sources with NodeNext-style ".js" import specifiers.
  webpack(config: { resolve: { extensionAlias?: Record<string, string[]> } }) {
    config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js"] };
    return config;
  },
};

export default nextConfig;
