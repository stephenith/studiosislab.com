import type { MetadataRoute } from "next";

const BASE_URL = "https://studiosislab.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/login",
          "/editor",
          "/dashboard",
          "/settings",
          "/games",
          "/resume/recents",
          "/tools/esign/",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
