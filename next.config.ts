import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/sign-in",
        destination: "/signin",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

