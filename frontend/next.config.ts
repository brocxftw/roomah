import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source:
          "/app/leads/:leadId([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})",
        destination: "/app/leads?lead=:leadId",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
