"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/Button';
import { useAuth } from '../context/AuthContext';
import { LogIn, User, HeartPulse, Menu, X } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

import { usePathname } from 'next/navigation';

export function Header() {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  // Hide header on protected app routes where Sidebar is used
  // Adjust this list as needed to match exact Sidebar scope
  const isAppRoute = pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/requests') ||
    pathname?.startsWith('/profile') ||
    pathname?.startsWith('/nearby-donors') ||
    pathname?.startsWith('/achievements') ||
    pathname?.startsWith('/donations');

  if (isAppRoute && user) return null;

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-primary-600 flex items-center" onClick={closeMenu}>
            <HeartPulse className="h-8 w-8 mr-2" />
            Vital
          </Link>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
            onClick={toggleMenu}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {user ? (
              <div className="flex items-center space-x-6">
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
                <Link href="/requests" className="text-gray-600 hover:text-gray-900">Requests</Link>
                <Link href="/requests/my-requests" className="text-gray-600 hover:text-gray-900">My Requests</Link>
                <Link href="/donations" className="text-gray-600 hover:text-gray-900">Donations</Link>
                <Link href="/nearby-donors" className="text-gray-600 hover:text-gray-900">Find Donors</Link>
                {user.role === 'admin' && (
                  <Link href="/admin" className="text-red-600 font-medium hover:text-red-700">Admin Console</Link>
                )}
                <NotificationBell />
                <Link href="/profile">
                  <Button variant="ghost" className="p-2">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center space-x-6">
                <Link href="/how-it-works" className="text-gray-600 hover:text-gray-900">How it Works</Link>
                <Link href="/requests" className="text-gray-600 hover:text-gray-900">Requests</Link>
                <Link href="/nearby-donors" className="text-gray-600 hover:text-gray-900">Find Donors</Link>
                <Link href="/login">
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <LogIn className="h-5 w-5" />
                    <span>Login</span>
                  </Button>
                </Link>
              </div>
            )}
          </nav>
        </div>

        {/* Mobile Navigation Dropdown */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
            {user ? (
              <div className="flex flex-col space-y-3">
                <Link href="/dashboard" onClick={closeMenu} className="block px-2 py-1 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-md">Dashboard</Link>
                <Link href="/requests" onClick={closeMenu} className="block px-2 py-1 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-md">Requests</Link>
                <Link href="/requests/my-requests" onClick={closeMenu} className="block px-2 py-1 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-md">My Requests</Link>
                <Link href="/donations" onClick={closeMenu} className="block px-2 py-1 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-md">Donations</Link>
                <Link href="/nearby-donors" onClick={closeMenu} className="block px-2 py-1 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-md">Find Donors</Link>
                {user.role === 'admin' && (
                  <Link href="/admin" onClick={closeMenu} className="block px-2 py-1 text-red-600 font-medium hover:bg-red-50 rounded-md">Admin Console</Link>
                )}
                <Link href="/profile" onClick={closeMenu} className="flex items-center space-x-2 px-2 py-1 text-gray-600 hover:text-primary-600 hover:bg-gray-50 rounded-md">
                  <User className="h-5 w-5" />
                  <span>Profile</span>
                </Link>
              </div>
            ) : (
              <Link href="/login" onClick={closeMenu}>
                <Button variant="ghost" className="w-full flex items-center justify-center space-x-2">
                  <LogIn className="h-5 w-5" />
                  <span>Login</span>
                </Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </header>
  );
}