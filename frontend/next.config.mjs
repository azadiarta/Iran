import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./lib/i18n.ts');

// Post/expense images are served as relative /media/... URLs (see
// core.serializers.RelativeImageField on the backend) and need no remote
// pattern — they're proxied through this app's own origin by rewrites()
// below. Only S3/CDN-hosted media (an absolute, different-origin URL) needs
// one, via NEXT_PUBLIC_MEDIA_URL — see backend/.env.example.
const remotePatterns = [];
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
  output: 'standalone',
  images: {
    remotePatterns,
  },
  async rewrites() {
    // Proxy API/admin/static/media requests to the Django backend so the
    // browser only ever talks to this app's own origin — no CORS/CSRF wiring
    // needed anywhere. On Railway, set BACKEND_INTERNAL_URL to the backend
    // service's private-network URL (e.g.
    // http://backend.railway.internal:8000) and leave NEXT_PUBLIC_API_URL
    // empty so the frontend's own API calls are also same-origin — see
    // DEPLOYMENT.md. In docker-compose, Caddy already routes these paths
    // straight to the backend before they ever reach this app, so these
    // rules are unused there. Defaults to the local-dev backend so
    // `npm run dev` works without any extra setup.
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000';
    return [
      { source: '/api/:path*', destination: `${backendUrl}/api/:path*` },
      { source: '/admin/:path*', destination: `${backendUrl}/admin/:path*` },
      { source: '/static/:path*', destination: `${backendUrl}/static/:path*` },
      { source: '/media/:path*', destination: `${backendUrl}/media/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
