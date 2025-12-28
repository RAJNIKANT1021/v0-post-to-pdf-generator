import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable serverless functions for API routes (required for Vercel)
  // Do NOT use "output: export" as it breaks API routes
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
