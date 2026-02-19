import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  // NOTE: output:'standalone' removed intentionally.
  // Railway's Railpack builder auto-detects Next.js and runs `next start`.
  // Using `next start` (without standalone) is simpler and more reliable:
  // - messages/ found at project root automatically
  // - static assets served by next start
  // - no file copying needed at startup
};

export default withNextIntl(nextConfig);
