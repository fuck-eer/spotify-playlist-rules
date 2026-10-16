import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rulemix/rules-engine", "@rulemix/spotify"],
};

export default nextConfig;
