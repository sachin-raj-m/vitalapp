"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { Loader2, MapPin, ShieldCheck } from 'lucide-react';
import type { BloodGroup } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { isRegistrationComplete } from '@/utils/auth';
import { PermanentDeferralQuestions } from '@/components/nbtc/PermanentDeferralQuestions';
import { addDays } from 'date-fns';
import { toast } from 'sonner';

interface PendingRegistration {
    userId: string;
    email: string;
    phone?: string;
}

interface CompleteRegistrationForm {
    fullName: string;
    dob: string;
    gender: string;
    phone: string;
    bloodGroup: BloodGroup | '';
    state: string;
    city: string;
    district: string;
    permanentZip: string;
    presentZip: string;
    lastDonationDate: string;
    willingTovelKm: number;
    availability: string[];
    hasConditions: boolean;
    consent: boolean;
}

export default function CompleteRegistration() {
    const router = useRouter();
    const { user } = useAuth();
    const [error, setError] = useState<string>('');
    const [status, setStatus] = useState<string>('loading');
    const [progress, setProgress] = useState<number>(0);
    const [pendingData, setPendingData] = useState<PendingRegistration | null>(null);
    const [formData, setFormData] = useState<CompleteRegistrationForm>({
        fullName: '',
        dob: '',
        gender: '',
        phone: '',
        bloodGroup: '',
        state: '',
        city: '',
        district: '',
        permanentZip: '',
        presentZip: '',
        lastDonationDate: '',
        willingTovelKm: 10,
        availability: ['Weekends'],
        hasConditions: false,
        consent: false
    });
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [nbtcEligible, setNbtcEligible] = useState<boolean>(true);

    useEffect(() => {
        const init = async () => {
            try {
                if (!user) {
                    router.push('/login');
                    return;
                }

                const isComplete = await isRegistrationComplete(user.id);
                if (isComplete) {
                    router.push('/dashboard');
                    return;
                }

                const storedData = localStorage.getItem('pendingRegistration');
                if (!storedData) {
                    setError('Registration data not found. Please register again.');
                    router.push('/register');
                    return;
                }

                try {
                    const data = JSON.parse(storedData);
                    if (data.userId !== user.id) throw new Error('User ID mismatch');

                    setPendingData(data);
                    if (data.phone) {
                        setFormData(prev => ({ ...prev, phone: data.phone }));
                    }
                    setStatus('form');
                } catch (err) {
                    console.error('Error processing stored data:', err);
                    throw new Error('Invalid registration data');
                }
            } catch (err: any) {
                console.error('Initialization error:', err);
                setError(err.message || 'Failed to load registration data');
                router.push('/register');
            }
        };

        if (user !== undefined) init();
    }, [router, user]);

    const validateForm = () => {
        const errors: Record<string, string> = {};

        if (!formData.fullName.trim()) errors.fullName = 'Full name is required';
        if (!formData.phone.trim()) errors.phone = 'Phone number is required';
        if (!formData.dob) errors.dob = 'Date of birth is required';
        if (!formData.gender) errors.gender = 'Gender is required';
        if (!formData.bloodGroup) errors.bloodGroup = 'Blood Group is required';
        if (!formData.state.trim()) errors.state = 'State is required';
        if (!formData.city.trim()) errors.city = 'City is required';
        if (!formData.district.trim()) errors.district = 'District is required';
        if (!formData.permanentZip.trim()) errors.permanentZip = 'Permanent Zip Code is required';
        if (!formData.presentZip.trim()) errors.presentZip = 'Present Zip Code is required';

        if (formData.dob) {
            const age = new Date().getFullYear() - new Date(formData.dob).getFullYear();
            if (age < 18) errors.dob = 'You must be at least 18 years old to register as a donor.';
        }

        if (!formData.consent) errors.consent = 'You must agree to the privacy policy to continue.';

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm() || !pendingData) return;

        setStatus('creating_profile');
        setProgress(50);

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session || session.user.id !== pendingData.userId) {
                setError('Session invalid. Please sign in again.');
                router.push('/login');
                return;
            }

            // Create/Update Profile
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert(
                    {
                        id: session.user.id,
                        email: pendingData.email,
                        full_name: formData.fullName,
                        phone: formData.phone,
                        dob: formData.dob,
                        gender: formData.gender,
                        blood_group: formData.bloodGroup || null,
                        city: formData.city,
                        district: formData.district,
                        state: formData.state,
                        availability: formData.availability,
                        has_medical_conditions: formData.hasConditions,
                        consent_agreed: true,
                        next_eligible_date: (() => {
                            if (!nbtcEligible) return null; // Permanent deferral
                            if (!formData.lastDonationDate) return new Date().toISOString();

                            const lastDate = new Date(formData.lastDonationDate);
                            const daysToAdd = formData.gender === 'Female' ? 120 : 90;
                            return addDays(lastDate, daysToAdd).toISOString();
                        })(),
                        // If NBTC ineligible, force is_donor to false (Volunteer Only)
                        is_donor: nbtcEligible,
                        is_available: nbtcEligible
                    },
                    { onConflict: 'id' }
                );

            if (profileError) throw profileError;

            setProgress(90);
            setStatus('finalizing');

            const { error: updateError } = await supabase.auth.updateUser({
                data: {
                    registration_completed: true,
                    phone: formData.phone,
                    full_name: formData.fullName
                }
            });

            if (updateError) throw updateError;

            setProgress(100);
            setStatus('completed');
            localStorage.removeItem('pendingRegistration');
            toast.success("Welcome to the Network!", {
                description: "You are now part of our lifesaving algorithm."
            });
            setTimeout(() => router.push('/dashboard'), 1500);

        } catch (err: any) {
            console.error('Registration completion error:', err);
            setError(err.message || 'Failed to complete registration');
            setStatus('error');
        }
    };

    const renderContent = () => {
        switch (status) {
            case 'loading':
                return (
                    <div className="flex flex-col items-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary-500 mb-4" />
                        <p className="text-gray-600">Loading...</p>
                    </div>
                );

            case 'form':
                return (
                    <>
                        <h2 className="text-xl font-bold mb-2">Complete Profile</h2>
                        <p className="text-sm text-gray-500 mb-6">Tell us a bit about yourself to find donors near you.</p>

                        {/* Storytelling: Precision Matching */}
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 flex gap-3">
                            <div className="bg-blue-100 rounded-full p-2 h-fit">
                                <MapPin className="w-4 h-4 text-blue-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-blue-900">Why accurate location matters?</h4>
                                <p className="text-xs text-blue-700 mt-1">
                                    Vital uses a <strong>hyper-local algorithm</strong>. We only alert you when a patient within 5-10km needs your specific blood type, preventing unnecessary travel and fatigue.
                                </p>
                            </div>
                        </div>

                        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

                        <form onSubmit={handleSubmit} className="space-y-4 text-left">
                            <Input
                                label="Full Name"
                                value={formData.fullName}
                                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                                required
                                placeholder="e.g. John Doe"
                                error={fieldErrors.fullName}
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input
                                    label="Date of Birth"
                                    type="date"
                                    value={formData.dob}
                                    onChange={e => setFormData({ ...formData, dob: e.target.value })}
                                    required
                                    error={fieldErrors.dob}
                                />
                                <Select
                                    label="Gender"
                                    value={formData.gender}
                                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                    options={[
                                        { value: '', label: 'Select Gender' },
                                        { value: 'Male', label: 'Male' },
                                        { value: 'Female', label: 'Female' },
                                        { value: 'Other', label: 'Other' },
                                    ]}
                                    required
                                    error={fieldErrors.gender}
                                />
                            </div>

                            <Input
                                label="Mobile Number"
                                type="tel"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                required
                                placeholder="+91 9876543210"
                                error={fieldErrors.phone}
                            />

                            <Select
                                label="Blood Group"
                                value={formData.bloodGroup}
                                onChange={e => setFormData({ ...formData, bloodGroup: e.target.value as BloodGroup })}
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

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="State"
                                    value={formData.state}
                                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                                    required
                                    placeholder="e.g. Kerala"
                                    error={fieldErrors.state}
                                />
                                <Input
                                    label="City"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                    required
                                    placeholder="e.g. Kochi"
                                    error={fieldErrors.city}
                                />
                            </div>
                            <Input
                                label="District"
                                value={formData.district}
                                onChange={e => setFormData({ ...formData, district: e.target.value })}
                                required
                                placeholder="e.g. Ernakulam"
                                error={fieldErrors.district}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Permanent Pin Code"
                                    value={formData.permanentZip}
                                    onChange={e => setFormData({ ...formData, permanentZip: e.target.value })}
                                    required
                                    placeholder="e.g. 560001"
                                    error={fieldErrors.permanentZip}
                                />
                                <Input
                                    label="Present Pin Code"
                                    value={formData.presentZip}
                                    onChange={e => setFormData({ ...formData, presentZip: e.target.value })}
                                    required
                                    placeholder="e.g. 560001"
                                    error={fieldErrors.presentZip}
                                />
                            </div>

                            {/* Preferences Section */}
                            <div className="border-t pt-4 mt-6">
                                <h3 className="text-sm font-semibold text-gray-900 mb-4">Donor Preferences</h3>

                                <div className="space-y-6">
                                    {/* Willingness to Travel */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            How far can you travel to donate?
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <input
                                                type="range"
                                                min="1" max="50"
                                                value={formData.willingTovelKm}
                                                onChange={e => setFormData({ ...formData, willingTovelKm: Number(e.target.value) })}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                                            />
                                            <span className="text-sm font-bold w-16 text-right text-primary-700">{formData.willingTovelKm} km</span>
                                        </div>
                                    </div>

                                    {/* Availability */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">When are you usually available?</label>
                                        <div className="flex gap-6">
                                            {['Weekdays', 'Weekends'].map(dayType => (
                                                <label key={dayType} className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.availability.includes(dayType)}
                                                        onChange={e => {
                                                            const newAvail = e.target.checked
                                                                ? [...formData.availability, dayType]
                                                                : formData.availability.filter(d => d !== dayType);
                                                            setFormData({ ...formData, availability: newAvail });
                                                        }}
                                                        className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                                                    />
                                                    <span className="text-sm text-gray-700">{dayType}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Last Donation */}
                                    <Input
                                        label="Last Donation Date (if any)"
                                        type="date"
                                        value={formData.lastDonationDate}
                                        onChange={e => setFormData({ ...formData, lastDonationDate: e.target.value })}
                                    />

                                    {/* Medical Deferral */}
                                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                                        <label className="flex items-start space-x-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={!formData.hasConditions}
                                                onChange={e => setFormData({ ...formData, hasConditions: !e.target.checked })}
                                                className="mt-1 rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                                            />
                                            <div className="text-sm text-gray-600">
                                                <span className="font-medium text-gray-900 block mb-0.5">I am fit to donate.</span>
                                                I confirm I do not have any serious chronic illness, recent major surgery, or disqualifying conditions.
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            {/* Consent Section (DPDP) */}
                            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                                <label className="flex items-start space-x-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.consent}
                                        onChange={e => setFormData({ ...formData, consent: e.target.checked })}
                                        className="mt-1 rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                                    />
                                    <div className="text-sm text-gray-600">
                                        <span className="font-bold text-gray-900 block mb-1">Privacy & Consent</span>
                                        <p>
                                            I consent to share my details (Name, Mobile, Location, Blood Group) with
                                            <strong> verified blood banks & hospitals </strong> only for the purpose of blood donation.
                                            We retain this data until you withdraw consent or delete your account.
                                        </p>
                                    </div>
                                </label>
                                {fieldErrors.consent && <p className="text-xs text-red-600 mt-2 font-medium">{fieldErrors.consent}</p>}
                            </div>

                            <Button type="submit" variant="primary" className="w-full mt-6">
                                Complete Registration
                            </Button>
                        </form>
                    </>
                );

            case 'creating_profile':
            case 'finalizing':
                return (
                    <div className="flex flex-col items-center py-8">
                        <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
                            <div className="bg-primary-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                        </div>
                        <p className="text-gray-600">{status === 'creating_profile' ? 'Creating profile...' : 'Finalizing...'}</p>
                    </div>
                );

            case 'completed':
                return (
                    <div className="text-center py-8">
                        <h2 className="text-xl font-bold text-green-600 mb-2">You're All Set!</h2>
                        <p className="text-gray-600">Redirecting to dashboard...</p>
                    </div>
                );

            case 'error':
                return (
                    <div className="text-center py-8">
                        <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
                        <p className="mb-4 text-gray-600">{error}</p>
                        <Button onClick={() => setStatus('form')} variant="secondary">Try Again</Button>
                    </div>
                );
        }
    };

    return (
        <div className="max-w-lg mx-auto p-4">
            <Card>
                <CardBody>{renderContent()}</CardBody>
            </Card>
        </div>
    );
}
