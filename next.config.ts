import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/game/:roomId",
        destination: "/tienlen/:roomId",
        permanent: false,
      },
      { source: "/solo", destination: "/tienlen/solo", permanent: false },
    ];
  },
};

export default nextConfig;
