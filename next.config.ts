import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "production" ? ".next-prod" : ".next"
};

export default nextConfig;
