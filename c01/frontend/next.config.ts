import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const c05Url = process.env.C05_URL ?? "http://c05:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.SPRING_URL ?? "http://localhost:8080"}/api/:path*`,
      },
      {
        source: "/image/:path*",
        destination: `${c05Url}/image/:path*`,
      },
      {
        source: "/snmp/:path*",
        destination: `${c05Url}/snmp/:path*`,
      },
    ];
  },
};

export default nextConfig;
