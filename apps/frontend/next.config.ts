/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lightweight-charts'],
  
  // Disable error overlay temporarily
  reactStrictMode: true,
  
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*', // Adjust to your NestJS port
      },
    ];
  },

  // Hide error overlays in development
  onError: (err) => {
    // Suppress errors from showing in overlay
    console.error('Suppressed error:', err);
  },

  // For Next.js 13+ - disable error overlay
  experimental: {
    errorOverlay: false,
  },

  // Additional option to reduce noise
  compiler: {
    removeConsole: false, // Set to true if you want to remove console.logs in production
  },
};

module.exports = nextConfig;