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

const MAX_FILE_SIZE = 1024 * 1024; // 1MB in bytes

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const validateForm = () => {
    const errors: Record<string, string> = {};

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }

    // Confirm password
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Full name validation
    if (!formData.fullName.trim()) {
      errors.fullName = 'Full name is required';
    }

    // Phone validation
    if (!formData.phone) {
      errors.phone = 'Phone number is required';
    }

    // Blood group validation
    if (!formData.bloodGroup) {
      errors.bloodGroup = 'Blood group is required';
    }

    // Proof type validation
    if (!formData.proofType) {
      errors.proofType = 'Please select proof type';
    }

    // File validation
    if (!formData.proofFile) {
      errors.proofFile = 'Please upload proof document';
    } else if (formData.proofFile.size > MAX_FILE_SIZE) {
      errors.proofFile = 'File size must be less than 1MB';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // First, create the auth user with email verification enabled
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: formData.phone,
            blood_group: formData.bloodGroup,
            proof_type: formData.proofType,
            is_donor: true,
            registration_completed: false // Flag to track completion
          },
          emailRedirectTo: `${window.location.origin}/complete-registration`
        }
      });

      if (authError) throw authError;

      if (!authData.user || !formData.proofFile) {
        throw new Error('Failed to create account');
      }

      // Store the registration data in localStorage for completion after verification
      const registrationData = {
        userId: authData.user.id,
        email: formData.email,
        fullName: formData.fullName,
        phone: formData.phone,
        bloodGroup: formData.bloodGroup,
        proofType: formData.proofType,
        proofFileName: formData.proofFile.name,
        proofFileType: formData.proofFile.type,
        proofFileSize: formData.proofFile.size
      };

      try {
        // Store file in localStorage (as base64)
        const reader = new FileReader();
        reader.readAsDataURL(formData.proofFile);

        reader.onload = function (e) {
          if (e.target?.result) {
            localStorage.setItem(
              'pendingRegistration',
              JSON.stringify({
                ...registrationData,
                proofFileData: e.target.result
              })
            );
          }
        };

        setVerificationSent(true);
      } catch (err) {
        console.error('Failed to store registration data:', err);
        throw new Error('Failed to prepare registration data. Please try again.');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err?.message?.includes('User already registered')) {
        setError('An account with this email already exists');
      } else if (err?.message) {
        setError(err.message);
      } else {
        setError('Failed to create account. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        setFieldErrors(prev => ({
          ...prev,
          proofFile: 'File size must be less than 1MB'
        }));
      } else {
        setFieldErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.proofFile;
          return newErrors;
        });
        setFormData(prev => ({ ...prev, proofFile: file }));
      }
    }
  };

  if (verificationSent) {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardBody className="text-center py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Verify Your Email
            </h2>
            <p className="text-gray-600 mb-6">
              We've sent a verification link to <strong>{formData.email}</strong>
            </p>
            <p className="text-gray-600 mb-6">
              Please check your email and click the verification link to complete your registration.
            </p>
            <div className="text-sm text-gray-500">
              Didn't receive the email?{' '}
              <button
                onClick={() => setVerificationSent(false)}
                className="text-primary-500 hover:text-primary-600"
              >
                Try again
              </button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

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
              placeholder="Enter your full name"
              error={fieldErrors.fullName}
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              autoComplete="email"
              placeholder="your.email@example.com"
              error={fieldErrors.email}
            />
            <Input
              label="Phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
              autoComplete="tel"
              placeholder="Enter your phone number"
              error={fieldErrors.phone}
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
              error={fieldErrors.bloodGroup}
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
              error={fieldErrors.proofType}
            />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Upload Proof</label>
              <Input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
                required
                className="w-full"
                error={fieldErrors.proofFile}
              />
              <p className="text-xs text-gray-500">
                Accepted formats: PDF, JPG, JPEG, PNG (Max size: 1MB)
              </p>
            </div>
            <Input
              label="Password"
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              required
              autoComplete="new-password"
              placeholder="Minimum 6 characters"
              error={fieldErrors.password}
            />
            <Input
              label="Confirm Password"
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              required
              autoComplete="new-password"
              placeholder="Re-enter your password"
              error={fieldErrors.confirmPassword}
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