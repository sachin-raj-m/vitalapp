import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  turbopack: {},
};

export default withPWA({
  dest: 'public',
  disable: false, // Enable in dev for testing
  register: true,
  skipWaiting: true,
  importScripts: ['/custom-sw.js'],
})(nextConfig);
