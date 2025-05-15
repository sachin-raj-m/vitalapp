import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/Button';
import { useAuth } from '../context/AuthContext';
import { LogIn, User, HeartPulse } from 'lucide-react';

export function Header() {
  const { user } = useAuth();

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-2xl font-bold text-primary-600 flex items-center">
            <HeartPulse className="h-8 w-8 mr-2" />
            Vital
          </Link>

          <nav>
            {user ? (
              <div className="flex items-center space-x-6">
                <Link to="/dashboard" className="text-gray-600 hover:text-gray-900">
                  Dashboard
                </Link>
                <Link to="/requests" className="text-gray-600 hover:text-gray-900">
                  Requests
                </Link>
                <Link to="/donations" className="text-gray-600 hover:text-gray-900">
                  Donations
                </Link>
                <Link to="/profile">
                  <Button variant="ghost" className="p-2">
                    <User className="h-5 w-5" />
                  </Button>
                </Link>
              </div>
            ) : (
              <Link to="/login">
                <Button variant="ghost" className="flex items-center space-x-2">
                  <LogIn className="h-5 w-5" />
                  <span>Login</span>
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}