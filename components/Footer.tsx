import React from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-gray-100 py-12 pb-24 md:pb-12 mt-auto">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">

        <div className="flex items-center space-x-2 mb-4">
          <span className="text-2xl font-bold text-gray-900">Vital</span>
        </div>

        <p className="text-gray-500 text-center max-w-md mb-8">
          Connecting donors with those in need, instantly. Join our mission to save lives every day.
        </p>

        <div className="flex flex-wrap justify-center gap-8 mb-8">
          <Link href="/requests" className="text-sm font-medium text-gray-600 hover:text-red-500 transition-colors">
            Find Donors
          </Link>
          <Link href="/requests/new" className="text-sm font-medium text-gray-600 hover:text-red-500 transition-colors">
            Request Blood
          </Link>
          <Link href="/register" className="text-sm font-medium text-gray-600 hover:text-red-500 transition-colors">
            Become a Donor
          </Link>
        </div>

        <div className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-colors">
          <Mail className="h-4 w-4" />
          <a href="mailto:sachin@vitalapp.in" className="text-sm font-medium">sachin@vitalapp.in</a>
        </div>

        <div className="mt-12 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Vital Blood Donation. All rights reserved.
        </div>
      </div>
    </footer>
  );
};