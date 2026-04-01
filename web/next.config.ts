import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/data-in-ai-revolution" : "",
  assetPrefix: isProd ? "/data-in-ai-revolution/" : "",
  images: { unoptimized: true },
};

export default nextConfig;
