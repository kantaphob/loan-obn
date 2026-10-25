import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      { source: '/thing/bank-loans', destination: '/thing/asset', permanent: false },
      { source: '/thing/payments', destination: '/thing/asset/payments', permanent: false },
      ...['boq', 'built-in', 'inventory', 'valuations', 'history'].map((section) => ({
        source: `/thing/${section}`,
        destination: `/thing/property/${section}`,
        permanent: false,
      })),
    ]
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
