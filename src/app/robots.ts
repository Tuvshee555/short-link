import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    // Short links are personal; keep search engines out of the dashboard and
    // out of the redirects themselves.
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
