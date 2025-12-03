/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lightweight-charts'],

  reactStrictMode: true,

  async rewrites() {
    return [
      // Specific API rewrites (these MUST come BEFORE the catch-all)
      // Note: /api/time-machine/* is NOT listed here - it's handled by Next.js API route
      {
        source: '/api/sentiment/:path*',
        destination: 'http://100.93.172.21:5717/api/premarket/predictions/:path*',
      },
      {
        source: '/api/proxy/desirability/:path*',
        destination: 'http://100.93.172.21:8508/desirability/:path*',
      },
      {
        source: '/api/proxy/intraday/:path*',
        destination: 'http://100.93.172.21:8505/intraday/:path*',
      },

      // ⚠️ CATCH-ALL: Proxy remaining /api/* to NestJS backend (port 5000)
      // This excludes paths already matched above AND Next.js API routes like /api/time-machine
      {
        source: '/api/:path((?!time-machine).*)*',
        destination: 'http://localhost:5000/api/:path*',
      },

      // Static asset proxies
      {
        source: '/watchlist-graphs/:path*',
        destination: 'http://100.93.172.21:6969/Watchlist_assets/:path*',
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '100.93.172.21',
        port: '6969',
        pathname: '/Watchlist_assets/**',
      },
      {
        protocol: 'http',
        hostname: '100.93.172.21',
        port: '6969',
        pathname: '/Sthiti/**',
      },
      {
        protocol: 'http',
        hostname: '100.93.172.21',
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
