import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/dre-custom',
        destination: '/dre-simulador',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
