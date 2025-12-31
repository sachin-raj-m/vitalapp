"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, AlertCircle, Activity, Info } from 'lucide-react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BloodGroup, UrgencyLevel } from '@/types';
import dynamic from 'next/dynamic';
import { logActivity } from '@/lib/logger';
import { toast } from 'sonner';

const Map = dynamic(() => import('@/components/Map'), {
    ssr: false,
    loading: () => (
        <div className="h-[400px] w-full bg-gray-100 animate-pulse flex items-center justify-center rounded-lg">
            <span className="text-gray-400">Loading Map...</span>
        </div>
    )
});

export default function CreateRequestPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (!user) {
        router.push('/login?redirect=/requests/new');
        return (
            <div className="flex justify-center items-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    const [formData, setFormData] = useState({
        bloodGroup: '' as BloodGroup,
        unitsNeeded: 1,
        dateNeeded: '',
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
        },
        city: '',
        zipcode: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsLoading(true);
        setError('');

        try {
            const { data, error: requestError } = await supabase
                .from('blood_requests')
                .insert({
                    user_id: user.id,
                    blood_group: formData.bloodGroup,
                    units_needed: formData.unitsNeeded,
                    date_needed: formData.dateNeeded,
                    hospital_name: formData.hospitalName,
                    hospital_address: formData.hospitalAddress,
                    urgency_level: formData.urgencyLevel,
                    notes: formData.notes,
                    contact_name: formData.contactName,
                    contact_phone: formData.contactPhone,
                    location: formData.location,
                    city: formData.city,
                    zipcode: formData.zipcode,
                    status: 'active'
                })
                .select(); // Ensure the inserted data is returned

            if (requestError) throw requestError;



            // ... inside component ...

            // Trigger Push Notifications (Fire and Forget)
            fetch('/api/notify/donors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: data?.[0]?.id, // Use the ID from the inserted data
                    bloodGroup: formData.bloodGroup,
                    hospitalName: formData.hospitalName,
                    city: formData.city,
                    urgencyLevel: formData.urgencyLevel
                })
            }).catch(e => console.error('Notification trigger failed', e));

            // Log Activity
            await logActivity({
                userId: user.id,
                action: 'CREATE_REQUEST',
                entityType: 'blood_requests',
                entityId: data?.[0]?.id,
                metadata: {
                    bloodGroup: formData.bloodGroup,
                    city: formData.city,
                    units: formData.unitsNeeded
                }
            });

            toast.success("Request Broadcasted Successfully", {
                description: `Our algorithm is now scanning for ${formData.bloodGroup} donors within 10km.`
            });

            router.push('/requests');
        } catch (err: any) {
            setError(err.message || 'Failed to create request');
        } finally {
            setIsLoading(false);
        }
    };

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
                    console.error('Error getting location', error);
                    toast.error('Unable to retrieve your location. Please check browser permissions.');
                }
            );
        } else {
            toast.error('Geolocation is not supported by your browser.');
        }
    };

    return (
        <div className="max-w-4xl mx-auto">
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

                    {/* Storytelling: Algorithm Preview */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mb-8">
                        <div className="flex items-start gap-4">
                            <div className="p-2 bg-red-100 rounded-full shrink-0">
                                <Activity className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900 text-sm">How it works</h4>
                                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                                    Once you submit, our <strong>Real-time Matching Engine</strong> will:
                                </p>
                                <ul className="mt-2 space-y-1">
                                    <li className="text-xs text-slate-500 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                        Scan for <strong>{formData.bloodGroup || 'compatible'}</strong> donors within a smart radius.
                                    </li>
                                    <li className="text-xs text-slate-500 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                        Filter out donors who recently donated.
                                    </li>
                                    <li className="text-xs text-slate-500 flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                                        Send an instant <strong>Push Notification</strong> to matches.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>

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

                            <Input
                                type="date"
                                label="Date Needed"
                                value={formData.dateNeeded}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={(e) => setFormData({ ...formData, dateNeeded: e.target.value })}
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

                        <div className="grid md:grid-cols-2 gap-4">
                            <Input
                                label="City"
                                value={formData.city}
                                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                required
                                placeholder="e.g. Bangalore"
                            />
                            <Input
                                label="Zip Code"
                                value={formData.zipcode}
                                onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })}
                                required
                                placeholder="e.g. 560001"
                            />
                        </div>

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
                                Location Selection (Click on map)
                            </label>
                            <div className="h-[300px] md:h-[400px] border border-gray-300 rounded-lg overflow-hidden relative z-0">
                                <Map
                                    interactive={true}
                                    center={{ lat: 20.5937, lng: 78.9629 }}
                                    zoom={5}
                                    selectedPosition={formData.location.latitude ? {
                                        lat: formData.location.latitude,
                                        lng: formData.location.longitude
                                    } : null}
                                    markers={[]}
                                    onLocationSelect={(loc) => {
                                        setFormData(prev => ({
                                            ...prev,
                                            location: {
                                                ...prev.location,
                                                latitude: loc.lat,
                                                longitude: loc.lng
                                            }
                                        }));
                                    }}
                                />
                            </div>
                            <div className="flex gap-2 mt-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleGetLocation}
                                    leftIcon={<MapPin className="h-5 w-5" />}
                                >
                                    Use My Current Location
                                </Button>
                                {formData.location.latitude !== 0 && (
                                    <span className="text-sm text-green-600 flex items-center">
                                        <MapPin className="h-4 w-4 mr-1" />
                                        Lat: {formData.location.latitude.toFixed(4)},
                                        Lng: {formData.location.longitude.toFixed(4)}
                                    </span>
                                )}
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
                                onClick={() => router.push('/requests')}
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
