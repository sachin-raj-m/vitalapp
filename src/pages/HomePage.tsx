import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { HeartPulse, Users, Award, Search } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';

export function HomePage() {
  const { user } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="text-center space-y-8">
        <h1 className="text-5xl font-bold text-gray-900">
          Save Lives Through Blood Donation
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Connect with blood donors in real-time and help save lives. Join our community of heroes making a difference.
        </p>
        <div className="flex justify-center gap-4">
          <Link to="/register">
            <Button size="lg" variant="primary">
              Become a Donor
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="secondary">
              Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="grid md:grid-cols-3 gap-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <HeartPulse className="h-12 w-12 text-primary-500" />
          </div>
          <h3 className="text-xl font-semibold">Real-time Matching</h3>
          <p className="text-gray-600">
            Find blood donors near you instantly with our advanced matching system.
          </p>
        </div>
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Users className="h-12 w-12 text-primary-500" />
          </div>
          <h3 className="text-xl font-semibold">Verified Donors</h3>
          <p className="text-gray-600">
            All donors are verified and screened to ensure safe blood donation.
          </p>
        </div>
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Award className="h-12 w-12 text-primary-500" />
          </div>
          <h3 className="text-xl font-semibold">Rewards Program</h3>
          <p className="text-gray-600">
            Earn points and badges for your life-saving contributions.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary-50 rounded-2xl p-8 text-center space-y-6">
        <h2 className="text-3xl font-bold text-gray-900">Ready to Save Lives?</h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Join thousands of donors who are making a difference in their communities.
        </p>
        <Link to="/register">
          <Button size="lg" variant="primary">
            Sign Up Now
          </Button>
        </Link>
      </section>
    </div>
  );
}