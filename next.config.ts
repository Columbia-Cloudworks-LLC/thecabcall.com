import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/feed/podcast.xml",
        destination: "/feed.xml",
      },
      {
        source: "/podcast",
        destination: "/archive",
      },
    ];
  },
};

export default nextConfig;
