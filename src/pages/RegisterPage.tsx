import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { BloodGroup } from '../types';

export function RegisterPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phone: '',
    bloodGroup: '' as BloodGroup,
    proofType: '',
    proofFile: null as File | null,
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!formData.proofFile) {
      setError('Please upload proof of blood group');
      return;
    }

    setIsLoading(true);

    try {
      // First create the auth user to get their ID
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
          }
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Failed to create user account');

      // Upload the proof file to Supabase storage with the user's ID in the path
      const fileExt = formData.proofFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${authData.user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('proofs')
        .upload(filePath, formData.proofFile, {
          upsert: false
        });

      if (uploadError) {
        throw new Error('Failed to upload proof document');
      }

      // Create a signed URL that expires in 1 hour (for initial verification)
      const { data, error: signedUrlError } = await supabase.storage
        .from('proofs')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (signedUrlError || !data) {
        throw new Error('Failed to generate secure URL for proof document');
      }

      // Create the user profile with the secure file path
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.fullName,
          phone: formData.phone,
          blood_group: formData.bloodGroup,
          blood_group_proof_type: formData.proofType,
          blood_group_proof_url: filePath, // Store the path, not the URL
          is_donor: true,
          is_available: true,
          location: {
            latitude: 0,
            longitude: 0,
            address: '',
          },
        });

      if (profileError) throw profileError;

      navigate('/dashboard');
    } catch (err: any) {
      if (err?.message?.includes('User already registered')) {
        setError('An account with this email already exists');
      } else {
        setError('Failed to create account. Please try again.');
        console.error('Registration error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, proofFile: e.target.files[0] });
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold text-center text-gray-900">Create Account</h1>
          <p className="text-center text-gray-600 mt-2">Join our community of blood donors</p>
        </CardHeader>
        <CardBody>
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              required
              autoComplete="name"
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="email"
            />
            <Input
              label="Phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              autoComplete="tel"
            />
            <Select
              label="Blood Group"
              value={formData.bloodGroup}
              onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value as BloodGroup })}
              options={[
                { value: '', label: 'Select Blood Group' },
                { value: 'A+', label: 'A+' },
                { value: 'A-', label: 'A-' },
                { value: 'B+', label: 'B+' },
                { value: 'B-', label: 'B-' },
                { value: 'AB+', label: 'AB+' },
                { value: 'AB-', label: 'AB-' },
                { value: 'O+', label: 'O+' },
                { value: 'O-', label: 'O-' },
              ]}
              required
            />
            <Select
              label="Blood Group Proof Type"
              value={formData.proofType}
              onChange={(e) => setFormData({ ...formData, proofType: e.target.value })}
              options={[
                { value: '', label: 'Select Proof Type' },
                { value: 'medical_certificate', label: 'Medical Certificate' },
                { value: 'hospital_report', label: 'Hospital Report' },
                { value: 'blood_donation_card', label: 'Blood Donation Card' },
                { value: 'lab_report', label: 'Laboratory Report' },
              ]}
              required
            />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Upload Proof</label>
              <Input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
                required
                className="w-full"
              />
              <p className="text-xs text-gray-500">Accepted formats: PDF, JPG, JPEG, PNG</p>
            </div>
            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              autoComplete="new-password"
            />
            <Input
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              autoComplete="new-password"
            />

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              isLoading={isLoading}
              leftIcon={<UserPlus className="h-5 w-5" />}
            >
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-500 hover:text-primary-600">
                Sign in
              </Link>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}