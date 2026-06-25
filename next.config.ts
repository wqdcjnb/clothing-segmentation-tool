import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许外部图片（DashScope 返回的结果图）
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dashscope-result-sh.oss-cn-shanghai.aliyuncs.com",
      },
    ],
  },
};

export default nextConfig;
