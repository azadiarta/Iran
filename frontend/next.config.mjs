import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n.ts');

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const apiUrlObj = new URL(apiUrl);

const remotePatterns = [
  {
    protocol: apiUrlObj.protocol.replace(':', ''),
    hostname: apiUrlObj.hostname,
    port: apiUrlObj.port,
    pathname: '/media/**',
  },
];

// When the backend serves media from an S3-compatible bucket/CDN
// (AWS_STORAGE_BUCKET_NAME set — see backend/.env.example), uploaded images
// are served from a different domain than NEXT_PUBLIC_API_URL. Set
// NEXT_PUBLIC_MEDIA_URL to that bucket/CDN origin so next/image can load them.
if (process.env.NEXT_PUBLIC_MEDIA_URL) {
  const mediaUrlObj = new URL(process.env.NEXT_PUBLIC_MEDIA_URL);
  remotePatterns.push({
    protocol: mediaUrlObj.protocol.replace(':', ''),
    hostname: mediaUrlObj.hostname,
    port: mediaUrlObj.port,
    pathname: '/**',
  });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns,
  },
};

export default withNextIntl(nextConfig);
