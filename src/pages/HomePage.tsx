import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { HeartPulse, Users, Award, Search, Activity, Clock, TrendingUp, Star } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalDonors: 0,
    totalRequests: 0,
    completedRequests: 0,
    successRate: 0
  });

  useEffect(() => {
    fetchPublicStats();
  }, []);

  const fetchPublicStats = async () => {
    try {
      // Get total donors with a simpler query
      const { data: donors, error: donorsError } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_donor', true);

      console.log('Donors query:', { donors, error: donorsError });

      const donorCount = donors?.length || 0;

      // Get total requests
      const { data: totalRequests } = await supabase
        .from('blood_requests')
        .select('id', { count: 'exact' });

      // Get completed requests
      const { data: completedRequests } = await supabase
        .from('blood_requests')
        .select('id', { count: 'exact' })
        .eq('status', 'completed');

      const total = totalRequests?.length || 0;
      const completed = completedRequests?.length || 0;

      setStats({
        totalDonors: donorCount,
        totalRequests: total,
        completedRequests: completed,
        successRate: total > 0 ? Math.round((completed / total) * 100) : 0
      });
    } catch (error) {
      console.error('Error fetching public stats:', error);
    }
  };

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
        <div className="flex justify-center">
          <Link to="/register">
            <Button size="lg" variant="primary">
              Become a Donor
            </Button>
          </Link>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Our Impact</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <Card>
              <CardBody className="text-center">
                <Users className="h-12 w-12 text-primary-500 mx-auto mb-4" />
                <div className="text-4xl font-bold text-gray-900 mb-2">{stats.totalDonors}</div>
                <p className="text-gray-600">Registered Donors</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <Activity className="h-12 w-12 text-primary-500 mx-auto mb-4" />
                <div className="text-4xl font-bold text-gray-900 mb-2">{stats.totalRequests}</div>
                <p className="text-gray-600">Total Requests</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <TrendingUp className="h-12 w-12 text-success-500 mx-auto mb-4" />
                <div className="text-4xl font-bold text-gray-900 mb-2">{stats.completedRequests}</div>
                <p className="text-gray-600">Lives Saved</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center">
                <Star className="h-12 w-12 text-warning-500 mx-auto mb-4" />
                <div className="text-4xl font-bold text-gray-900 mb-2">{stats.successRate}%</div>
                <p className="text-gray-600">Success Rate</p>
              </CardBody>
            </Card>
          </div>
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

      {/* Success Stories */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Success Stories</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardBody className="text-center p-6">
                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                  <HeartPulse className="h-10 w-10 text-primary-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Sarah's Story</h3>
                <p className="text-gray-600">
                  "I found a donor within minutes during an emergency. This platform saved my mother's life."
                </p>
                <p className="text-sm text-gray-500 mt-4">Mumbai, India</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center p-6">
                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                  <HeartPulse className="h-10 w-10 text-primary-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Rahul's Impact</h3>
                <p className="text-gray-600">
                  "Being a regular donor has helped me save 12 lives so far. It's the most rewarding experience."
                </p>
                <p className="text-sm text-gray-500 mt-4">Delhi, India</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="text-center p-6">
                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
                  <HeartPulse className="h-10 w-10 text-primary-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Hospital Partnership</h3>
                <p className="text-gray-600">
                  "This platform has revolutionized how we handle blood requirements. Response time has improved by 70%."
                </p>
                <p className="text-sm text-gray-500 mt-4">Bangalore, India</p>
              </CardBody>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="bg-primary-50 rounded-2xl p-8 text-center space-y-6">
        <h2 className="text-3xl font-bold text-gray-900">Ready to Save Lives?</h2>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Join thousands of donors who are making a difference in their communities.
        </p>
        <Link to="/register">
          <Button size="lg" variant="primary">
            Become a Donor Now
          </Button>
        </Link>
      </section>
    </div>
  );
}