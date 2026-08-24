import type { Metadata } from "next";
import "./globals.css";

const githubOwner = process.env.GITHUB_REPOSITORY_OWNER;
const metadataOrigin = githubOwner
  ? `https://${githubOwner}.github.io`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(metadataOrigin),
  title: "Orbit School & Project Tracker",
  description: "A private, local-first command centre for school modules, projects and deadlines.",
  other: { "codex-preview": "development" },
  openGraph: {
    title: "Orbit School & Project Tracker",
    description: "Everything in motion. One local-first command centre for school and projects.",
    images: [{ url: "/og.png", width: 1732, height: 910, alt: "Orbit School & Project Tracker" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orbit School & Project Tracker",
    description: "Everything in motion. One local-first command centre for school and projects.",
    images: ["/og.png"],
  },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
