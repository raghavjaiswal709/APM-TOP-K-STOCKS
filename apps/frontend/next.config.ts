/** @type {import('next').NextConfig} */
const SERVER_IP = process.env.SERVER_IP || '100.93.172.21';

const nextConfig = {
  transpilePackages: ['lightweight-charts'],

  reactStrictMode: true,

  // A failing lint rule should not break the production image build. `next lint`
  // still runs in dev and can be run in CI; it just no longer blocks `next build`.
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Barrel-optimize the libraries that are imported by name across dozens of files.
  // Without this, a single `import { Foo } from 'lucide-react'` forces the bundler to
  // walk the library's entire barrel (lucide-react alone re-exports 1000+ icons),
  // which massively inflates dev-compile time and per-page JS. This rewrites those
  // imports to deep path imports so only what's used is pulled in.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@heroicons/react',
      'date-fns',
      'date-fns-tz',
      'recharts',
      'framer-motion',
      'radix-ui',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      'cmdk',
      'sonner',
      'd3-format',
      'd3-time-format',
    ],
  },

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
        source: '/api/proxy/visualize/:path*',
        destination: `http://${SERVER_IP}:8506/visualize/:path*`,
      },
      {
        source: '/api/proxy/intraday/:path*',
        destination: `http://${SERVER_IP}:8505/intraday/:path*`,
      },

      // UMAP Clustering V2 API (port 6968)
      {
        source: '/api/v2/clustering/:path*',
        destination: `http://${SERVER_IP}:6968/api/v2/clustering/:path*`,
      },
      {
        source: '/api/v2/health',
        destination: `http://${SERVER_IP}:6968/health`,
      },

      // PatternPool Overlay API (port 8765)
      {
        source: '/api/pattern-overlay/:path*',
        destination: `http://${SERVER_IP}:8765/:path*`,
      },

      // ⚠️ CATCH-ALL: Proxy remaining /api/* to NestJS backend (port 5002)
      // Excludes: time-machine (Next.js route), senta/* (Next.js DB routes — dynamic
      // segments are shadowed by catch-all rewrites, so must be explicitly excluded)
      {
        source: '/api/:path((?!time-machine|senta).*)*',
        destination: `${process.env.BACKEND_URL || 'http://localhost:5002'}/api/:path*`,
      },

      // Static asset proxies
      {
        source: '/watchlist-graphs/:path*',
        destination: `http://${SERVER_IP}:6969/Watchlist_assets/:path*`,
      },

      // Sthiti data proxy for historical data
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
