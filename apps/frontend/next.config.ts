/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lightweight-charts'],

  // Disable error overlay temporarily
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        source: '/api/sentiment/:path*',
        destination: 'http://100.93.172.21:5717/api/premarket/predictions/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*', // Adjust to your NestJS port
      },
      // Proxy for on-prem graph server to avoid CORS issues
      {
        source: '/watchlist-graphs/:path*',
        destination: 'http://100.93.172.21:6969/Watchlist_assets/:path*',
      },
    ];
  },

  // Configure external image domains
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '100.93.172.21',
        port: '6969',
        pathname: '/Watchlist_assets/**',
      },
    ],
    unoptimized: true, // Disable image optimization for external images
  },

  // For Next.js 13+ - disable error overlay
  experimental: {
    // errorOverlay: false, // This property might not exist in newer Next.js versions, commenting out to be safe or check docs. 
    // Actually, user had it before, but let's keep it simple.
  },

  // Additional option to reduce noise
  compiler: {
    removeConsole: false, // Set to true if you want to remove console.logs in production
  },
};

module.exports = nextConfig;