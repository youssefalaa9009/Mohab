import type { NextConfig } from "next";

/**
 * Remote image hosts allowed through `next/image`.
 * Product and editorial uploads live in the R2 bucket exposed at NEXT_PUBLIC_MEDIA_URL.
 */
function mediaRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL;
  if (!mediaUrl) return [];
  const { protocol, hostname } = new URL(mediaUrl);
  return [{ protocol: protocol.replace(":", "") as "http" | "https", hostname, pathname: "/**" }];
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 90],
    minimumCacheTTL: 2_678_400, // 31 days — uploads are immutable (content-hashed keys)
    remotePatterns: mediaRemotePatterns(),
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
