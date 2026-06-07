import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n.ts');

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const apiUrlObj = new URL(apiUrl);

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: apiUrlObj.protocol.replace(':', ''),
        hostname: apiUrlObj.hostname,
        port: apiUrlObj.port,
        pathname: '/media/**',
      },
    ],
  },
};

export default withNextIntl(nextConfig);
