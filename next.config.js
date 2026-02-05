/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  // assetPrefix: '.', // Not needed with electron-serve
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
