import type { NextConfig } from "next";

const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] || "";
const isProjectPage = Boolean(process.env.GITHUB_ACTIONS && repo && !repo.endsWith(".github.io"));

const nextConfig: NextConfig = {
  output: process.env.GITHUB_ACTIONS ? "export" : undefined,
  trailingSlash: Boolean(process.env.GITHUB_ACTIONS),
  basePath: isProjectPage ? `/${repo}` : "",
  assetPrefix: isProjectPage ? `/${repo}/` : "",
  images: { unoptimized: true },
  // The Sites starter includes optional Cloudflare-only database types that are
  // not part of this local-first app. Vinext checks the app normally; the
  // GitHub export skips those unused starter declarations.
  typescript: { ignoreBuildErrors: Boolean(process.env.GITHUB_ACTIONS) },
};

export default nextConfig;
