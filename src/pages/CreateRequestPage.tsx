import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Alert';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { BloodGroup, UrgencyLevel } from '../types';

export function CreateRequestPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    bloodGroup: '' as BloodGroup,
    unitsNeeded: 1,
    hospitalName: '',
    hospitalAddress: '',
    urgencyLevel: '' as UrgencyLevel,
    notes: '',
    contactName: user?.full_name || '',
    contactPhone: user?.phone || '',
    location: {
      latitude: 0,
      longitude: 0,
      address: ''
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsLoading(true);
    setError('');

    try {
      const { error: requestError } = await supabase
        .from('blood_requests')
        .insert({
          user_id: user.id,
          blood_group: formData.bloodGroup,
          units_needed: formData.unitsNeeded,
          hospital_name: formData.hospitalName,
          hospital_address: formData.hospitalAddress,
          urgency_level: formData.urgencyLevel,
          notes: formData.notes,
          contact_name: formData.contactName,
          contact_phone: formData.contactPhone,
          location: formData.location,
          status: 'active'
        });

      if (requestError) throw requestError;

      navigate('/requests');
    } catch (err: any) {
      setError(err.message || 'Failed to create request');
    } finally {
      setIsLoading(false);
    }
  };

  // TODO: Implement geolocation
  const handleGetLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            location: {
              ...prev.location,
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            }
          }));
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold text-gray-900">Create Blood Request</h1>
          <p className="text-gray-600">Fill in the details to create a new blood request</p>
        </CardHeader>
        <CardBody>
          {error && (
            <Alert variant="error" className="mb-4">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
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
              
              <Input
                type="number"
                label="Units Needed"
                min={1}
                value={formData.unitsNeeded}
                onChange={(e) => setFormData({ ...formData, unitsNeeded: parseInt(e.target.value) })}
                required
              />
            </div>

            <Input
              label="Hospital Name"
              value={formData.hospitalName}
              onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })}
              required
            />

            <Input
              label="Hospital Address"
              value={formData.hospitalAddress}
              onChange={(e) => setFormData({ ...formData, hospitalAddress: e.target.value })}
              required
            />

            <Select
              label="Urgency Level"
              value={formData.urgencyLevel}
              onChange={(e) => setFormData({ ...formData, urgencyLevel: e.target.value as UrgencyLevel })}
              options={[
                { value: '', label: 'Select Urgency Level' },
                { value: 'High', label: 'High' },
                { value: 'Medium', label: 'Medium' },
                { value: 'Low', label: 'Low' },
              ]}
              required
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleGetLocation}
                  leftIcon={<MapPin className="h-5 w-5" />}
                >
                  Get Current Location
                </Button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="Contact Name"
                value={formData.contactName}
                onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                required
              />
              
              <Input
                label="Contact Phone"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                required
              />
            </div>

            <Textarea
              label="Additional Notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional information that might be helpful..."
            />

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate('/requests')}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                leftIcon={<AlertCircle className="h-5 w-5" />}
              >
                Create Request
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}