/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lightweight-charts'],

  reactStrictMode: true,

  async rewrites() {
    return [
      // ✅ CRITICAL: Time Machine MUST come BEFORE generic /api/:path*
      {
        source: '/api/time-machine/:path*',
        destination: 'http://100.93.172.21:6969/:path*',
      },

      // Specific API rewrites (these should also be before the catch-all)
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

      // ⚠️ CATCH-ALL MUST BE LAST (matches everything else)
      {
        source: '/api/:path*',
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
