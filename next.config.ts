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
        source: "/dispatches/:slug",
        destination: "/incidents/:slug",
      },
    ];
  },
};

export default nextConfig;
