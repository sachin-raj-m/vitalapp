"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from './Logo';
import { cn } from '@/lib/cn';
import { isAppRoute, isHybridRoute, isStandaloneRoute } from '@/lib/routes';

const NAV = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/requests', label: 'Open requests' },
];

export function Header() {
  const { user } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setIsMenuOpen(false), [pathname]);

  if (isStandaloneRoute(pathname) || isAppRoute(pathname)) return null;
  if (isHybridRoute(pathname) && user) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200/70 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Vital home" className="group -mb-1">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={cn(
                'relative py-1 text-sm font-medium transition-colors hover:text-gray-900',
                'after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded-full after:bg-red-600 after:transition-transform after:duration-200',
                pathname === item.href ? 'text-gray-900 after:scale-x-100' : 'text-gray-600 after:scale-x-0 hover:after:scale-x-100',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Link
              href="/dashboard"
              className="press inline-flex h-9 items-center gap-1.5 rounded-md bg-gray-900 px-3.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Open dashboard <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link href="/login" className="px-3 text-sm font-medium text-gray-700 transition-colors hover:text-red-700">
                Sign in
              </Link>
              <Link
                href="/register"
                className="press inline-flex h-9 items-center rounded-md bg-red-600 px-3.5 text-sm font-semibold text-white shadow-sm shadow-red-600/25 hover:bg-red-700"
              >
                Become a donor
              </Link>
            </>
          )}
        </div>

        <button
          className="-mr-2 rounded-md p-2 text-gray-700 md:hidden"
          onClick={() => setIsMenuOpen(o => !o)}
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {isMenuOpen && (
        <div id="mobile-menu" className="border-t border-gray-200 bg-white px-5 pb-6 pt-2 md:hidden">
          <nav className="flex flex-col" aria-label="Mobile">
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={pathname === item.href ? 'page' : undefined}
                className={cn('border-b border-gray-200 py-3.5 text-[15px] font-medium', pathname === item.href ? 'text-red-700' : 'text-gray-800')}
              >
                {item.label}
              </Link>
            ))}
            {!user && (
              <Link href="/login" className="border-b border-gray-200 py-3.5 text-[15px] font-medium text-gray-800">
                Sign in
              </Link>
            )}
          </nav>
          <Link
            href={user ? '/dashboard' : '/register'}
            className={cn(
              'press mt-5 flex h-11 items-center justify-center rounded-md text-[15px] font-semibold',
              user ? 'bg-gray-900 text-white' : 'bg-red-600 text-white shadow-sm shadow-red-600/25',
            )}
          >
            {user ? 'Open dashboard' : 'Become a donor'}
          </Link>
        </div>
      )}
    </header>
  );
}
