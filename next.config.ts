import type { NextConfig } from "next";

const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] || "";
const isProjectPage = Boolean(
  process.env.GITHUB_ACTIONS && repo && !repo.endsWith(".github.io"),
);

const nextConfig: NextConfig = {
  output: process.env.GITHUB_ACTIONS ? "export" : undefined,
  trailingSlash: Boolean(process.env.GITHUB_ACTIONS),
  basePath: isProjectPage ? `/${repo}` : "",
  assetPrefix: isProjectPage ? `/${repo}/` : "",
  images: { unoptimized: true },
};

export default nextConfig;
