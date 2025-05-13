import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HeartPulse, Menu, X, Bell, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);
  const toggleProfile = () => setIsProfileOpen(!isProfileOpen);

  const isActive = (path: string) => {
    return location.pathname === path ? 'text-primary-500' : 'text-gray-700 hover:text-primary-500';
  };

  return (
    <header className="bg-white shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <HeartPulse className="h-8 w-8 text-primary-500" />
              <span className="ml-2 text-xl font-bold text-primary-500">Vital</span>
            </Link>
            <nav className="hidden md:ml-8 md:flex md:space-x-8">
              <Link 
                to="/" 
                className={`inline-flex items-center px-1 pt-1 border-b-2 
                  ${location.pathname === '/' ? 'border-primary-500 text-primary-500' : 'border-transparent hover:border-gray-300 text-gray-500 hover:text-gray-700'} 
                  font-medium`}
              >
                Home
              </Link>
              <Link 
                to="/requests" 
                className={`inline-flex items-center px-1 pt-1 border-b-2 
                  ${location.pathname === '/requests' ? 'border-primary-500 text-primary-500' : 'border-transparent hover:border-gray-300 text-gray-500 hover:text-gray-700'} 
                  font-medium`}
              >
                Requests
              </Link>
              {user && (
                <>
                  <Link 
                    to="/donations" 
                    className={`inline-flex items-center px-1 pt-1 border-b-2 
                      ${location.pathname === '/donations' ? 'border-primary-500 text-primary-500' : 'border-transparent hover:border-gray-300 text-gray-500 hover:text-gray-700'} 
                      font-medium`}
                  >
                    My Donations
                  </Link>
                  <Link 
                    to="/achievements" 
                    className={`inline-flex items-center px-1 pt-1 border-b-2 
                      ${location.pathname === '/achievements' ? 'border-primary-500 text-primary-500' : 'border-transparent hover:border-gray-300 text-gray-500 hover:text-gray-700'} 
                      font-medium`}
                  >
                    Achievements
                  </Link>
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center">
            {user ? (
              <div className="hidden md:ml-4 md:flex md:items-center">
                <button 
                  className="p-2 rounded-full text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <Bell className="h-6 w-6" />
                </button>
                
                <div className="ml-4 relative">
                  <div>
                    <button
                      onClick={toggleProfile}
                      className="flex items-center max-w-xs rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <span className="inline-block h-8 w-8 overflow-hidden rounded-full bg-gray-100">
                        <User className="h-full w-full text-gray-400" />
                      </span>
                      <span className="ml-2 text-gray-700">{user.full_name}</span>
                    </button>
                  </div>
                  
                  {isProfileOpen && (
                    <div 
                      className="origin-top-right absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5"
                    >
                      <div className="py-1">
                        <Link 
                          to="/profile" 
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsProfileOpen(false)}
                        >
                          Your Profile
                        </Link>
                        <button
                          onClick={() => {
                            signOut();
                            setIsProfileOpen(false);
                          }}
                          className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="hidden md:flex md:items-center md:space-x-4">
                <Link
                  to="/login"
                  className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="bg-primary-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-600"
                >
                  Sign up
                </Link>
              </div>
            )}
            
            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button
                onClick={toggleMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
              >
                <span className="sr-only">Open main menu</span>
                {isMenuOpen ? (
                  <X className="block h-6 w-6" />
                ) : (
                  <Menu className="block h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden">
          <div className="pt-2 pb-3 space-y-1">
            <Link
              to="/"
              className={`block pl-3 pr-4 py-2 border-l-4 ${
                location.pathname === '/'
                  ? 'border-primary-500 text-primary-500 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
              } text-base font-medium`}
              onClick={closeMenu}
            >
              Home
            </Link>
            <Link
              to="/requests"
              className={`block pl-3 pr-4 py-2 border-l-4 ${
                location.pathname === '/requests'
                  ? 'border-primary-500 text-primary-500 bg-primary-50'
                  : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
              } text-base font-medium`}
              onClick={closeMenu}
            >
              Requests
            </Link>
            {user && (
              <>
                <Link
                  to="/donations"
                  className={`block pl-3 pr-4 py-2 border-l-4 ${
                    location.pathname === '/donations'
                      ? 'border-primary-500 text-primary-500 bg-primary-50'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                  } text-base font-medium`}
                  onClick={closeMenu}
                >
                  My Donations
                </Link>
                <Link
                  to="/achievements"
                  className={`block pl-3 pr-4 py-2 border-l-4 ${
                    location.pathname === '/achievements'
                      ? 'border-primary-500 text-primary-500 bg-primary-50'
                      : 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
                  } text-base font-medium`}
                  onClick={closeMenu}
                >
                  Achievements
                </Link>
              </>
            )}
          </div>
          
          {user ? (
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="flex items-center px-4">
                <div className="flex-shrink-0">
                  <span className="inline-block h-10 w-10 rounded-full overflow-hidden bg-gray-100">
                    <User className="h-full w-full text-gray-400" />
                  </span>
                </div>
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">{user.full_name}</div>
                  <div className="text-sm font-medium text-gray-500">{user.email}</div>
                </div>
                <button className="ml-auto flex-shrink-0 p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500">
                  <Bell className="h-6 w-6" />
                </button>
              </div>
              <div className="mt-3 space-y-1">
                <Link
                  to="/profile"
                  className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  onClick={closeMenu}
                >
                  Your Profile
                </Link>
                <button
                  onClick={() => {
                    signOut();
                    closeMenu();
                  }}
                  className="w-full text-left block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="flex items-center justify-around">
                <Link
                  to="/login"
                  className="text-gray-500 hover:text-gray-800 px-4 py-2 text-base font-medium"
                  onClick={closeMenu}
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="bg-primary-500 text-white px-4 py-2 rounded-md text-base font-medium hover:bg-primary-600"
                  onClick={closeMenu}
                >
                  Sign up
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
};