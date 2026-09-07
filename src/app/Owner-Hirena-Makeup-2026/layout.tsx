import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Owner Dashboard | Hirena Makeup",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
