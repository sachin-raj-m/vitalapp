"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/Button';
import { useAuth } from '../context/AuthContext';
import { LogIn, User, HeartPulse, Menu, X, LayoutDashboard } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

import { usePathname } from 'next/navigation';

export function Header() {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  // 1. Strictly Hide on Public Profile (Custom Layout)
  if (pathname?.startsWith('/donor')) return null;

  // 2. Strictly Hide on Protected Routes (Sidebar is present)
  // These routes are guarded, so if user is here, they are logged in (or redirecting).
  const isProtectedRoute =
    pathname?.startsWith('/dashboard') ||
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/profile') ||
    pathname?.startsWith('/nearby-donors') ||
    pathname?.startsWith('/achievements') ||
    pathname?.startsWith('/donations');

  if (isProtectedRoute) return null;

  // 3. Hybrid Routes (e.g. Requests)
  // If user is logged in, they see Sidebar. If guest, they see Header.
  const isHybridRoute = pathname?.startsWith('/requests');

  if (isHybridRoute && user) return null;

  // For other routes (Home, Login, Register), show Header.

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="w-full px-4 md:px-8 py-4">
        <div className="flex items-center justify-between">
          <Link href={user ? "/dashboard" : "/"} className="text-2xl font-bold text-primary-600 flex items-center" onClick={closeMenu}>
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
                <Link href="/dashboard">
                  <Button variant="primary" className="flex items-center space-x-2">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
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
                <Link href="/dashboard" onClick={closeMenu} className="block px-2 py-1 text-primary-600 font-medium hover:bg-gray-50 rounded-md">
                  Go to Dashboard
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