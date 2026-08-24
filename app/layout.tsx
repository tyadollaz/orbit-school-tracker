import type { Metadata } from "next";
import "./globals.css";

const githubOwner = process.env.GITHUB_REPOSITORY_OWNER;
const githubRepo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const githubPath =
  githubRepo && !githubRepo.endsWith(".github.io") ? `/${githubRepo}` : "";
const siteUrl = githubOwner
  ? `https://${githubOwner}.github.io${githubPath}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(`${siteUrl}/`),
  title: "Orbit School & Project Tracker",
  description:
    "A private, local-first command centre for school modules, projects and deadlines.",
  other: { "codex-preview": "development" },
  openGraph: {
    title: "Orbit School & Project Tracker",
    description:
      "Everything in motion. One local-first command centre for school and projects.",
    images: [
      {
        url: `${siteUrl}/og.png`,
        width: 1731,
        height: 909,
        alt: "Orbit School & Project Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orbit School & Project Tracker",
    description:
      "Everything in motion. One local-first command centre for school and projects.",
    images: [`${siteUrl}/og.png`],
  },
  icons: { icon: `${siteUrl}/favicon.svg`, shortcut: `${siteUrl}/favicon.svg` },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
