import React from 'react';
import Link from 'next/link';
import { HeartPulse, Instagram, Twitter, Facebook, Mail } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          <div className="space-y-8 xl:col-span-1">
            <div className="flex items-center">
              <HeartPulse className="h-8 w-8 text-primary-500" />
              <span className="ml-2 text-xl font-bold text-primary-500">Vital</span>
            </div>
            <p className="text-gray-500 text-base">
              Connecting blood donors with recipients in real-time to save lives.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Facebook</span>
                <Facebook className="h-6 w-6" />
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Instagram</span>
                <Instagram className="h-6 w-6" />
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Twitter</span>
                <Twitter className="h-6 w-6" />
              </a>
            </div>
          </div>
          <div className="mt-12 grid grid-cols-2 gap-8 xl:mt-0 xl:col-span-2">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Platform</h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <Link href="/requests" className="text-base text-gray-500 hover:text-gray-900">
                      Find Donors
                    </Link>
                  </li>
                  <li>
                    <Link href="/requests/new" className="text-base text-gray-500 hover:text-gray-900">
                      Request Blood
                    </Link>
                  </li>
                  <li>
                    <Link href="/donations" className="text-base text-gray-500 hover:text-gray-900">
                      Donation History
                    </Link>
                  </li>
                  <li>
                    <Link href="/achievements" className="text-base text-gray-500 hover:text-gray-900">
                      Achievements
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Support</h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <Link href="/about" className="text-base text-gray-500 hover:text-gray-900">
                      About Us
                    </Link>
                  </li>
                  <li>
                    <Link href="/faq" className="text-base text-gray-500 hover:text-gray-900">
                      FAQs
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="text-base text-gray-500 hover:text-gray-900">
                      Contact
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy" className="text-base text-gray-500 hover:text-gray-900">
                      Privacy Policy
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Resources</h3>
                <ul className="mt-4 space-y-4">
                  <li>
                    <a href="#" className="text-base text-gray-500 hover:text-gray-900">
                      Blood Types Guide
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-gray-500 hover:text-gray-900">
                      Donation Process
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-gray-500 hover:text-gray-900">
                      Health Requirements
                    </a>
                  </li>
                  <li>
                    <a href="#" className="text-base text-gray-500 hover:text-gray-900">
                      Nearby Hospitals
                    </a>
                  </li>
                </ul>
              </div>
              <div className="mt-12 md:mt-0">
                <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Get in Touch</h3>
                <div className="mt-4 space-y-4">
                  <p className="text-base text-gray-500">
                    Have questions or need assistance? Contact our support team.
                  </p>
                  <a
                    href="mailto:support@vitaldonation.org"
                    className="flex items-center text-primary-500 hover:text-primary-600"
                  >
                    <Mail className="h-5 w-5 mr-2" />
                    support@vitaldonation.org
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 border-t border-gray-200 pt-8">
          <p className="text-base text-gray-400 text-center">
            &copy; {new Date().getFullYear()} Vital Blood Donation. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};