/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  ...(process.env.GITHUB_PAGES === "1"
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true }
      }
    : {})
};

export default nextConfig;
