import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // برای بستهٔ دسکتاپ به sharp نیاز نیست (برنامه از next/image استفاده نمی‌کند)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
