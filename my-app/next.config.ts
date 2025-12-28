import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static HTML export
  output: "export",
  // Use trailing slashes to make exported paths predictable
  trailingSlash: true,
  // Set basePath for GitHub Pages (subdirectory deployment)
  basePath: "/v0-post-to-pdf-generator",
  // Ensure CSS and assets are properly loaded with basePath
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
