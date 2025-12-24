/** @type {import('next').NextConfig} */
const SERVER_IP = process.env.SERVER_IP || '100.93.172.21';

const nextConfig = {
  transpilePackages: ['lightweight-charts'],

  reactStrictMode: true,

  async rewrites() {
    return [
      // Specific API rewrites (these MUST come BEFORE the catch-all)
      // Note: /api/time-machine/* is NOT listed here - it's handled by Next.js API route
      {
        source: '/api/sentiment/:path*',
        destination: `http://${SERVER_IP}:5717/api/premarket/predictions/:path*`,
      },
      {
        source: '/api/proxy/desirability/:path*',
        destination: `http://${SERVER_IP}:8508/desirability/:path*`,
      },
      {
        source: '/api/proxy/intraday/:path*',
        destination: `http://${SERVER_IP}:8505/intraday/:path*`,
      },

      // ⚠️ CATCH-ALL: Proxy remaining /api/* to NestJS backend (port 5002)
      // This excludes paths already matched above AND Next.js API routes like /api/time-machine
      // Uses BACKEND_URL env var for Docker compatibility (defaults to localhost for local dev)
      {
        source: '/api/:path((?!time-machine).*)*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:5002'}/api/:path*`,
      },

      // Static asset proxies
      {
        source: '/watchlist-graphs/:path*',
        destination: `http://${SERVER_IP}:6969/Watchlist_assets/:path*`,
      },

      // ✅ NEW: Sthiti data proxy for historical charts, headlines, clusters, predictions
      {
        source: '/sthiti-data/:path*',
        destination: `http://${SERVER_IP}:6969/Sthiti/:path*`,
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: SERVER_IP,
        port: '6969',
        pathname: '/Watchlist_assets/**',
      },
      {
        protocol: 'http',
        hostname: SERVER_IP,
        port: '6969',
        pathname: '/Sthiti/**',
      },
      {
        protocol: 'http',
        hostname: SERVER_IP,
        port: '6969',
        pathname: '/Live/**',
      },
    ],
    unoptimized: true,
  },

  compiler: {
    removeConsole: false,
  },
};

module.exports = nextConfig;
