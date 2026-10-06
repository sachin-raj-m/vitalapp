"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { BLOOD_GROUPS, formatBloodGroup } from '@/lib/blood-compatibility';
import { Input, Textarea } from '@/components/ui/Input';
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
        <div className="h-full w-full animate-pulse bg-gray-100" />
    )
});

export default function CreateRequestPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        bloodGroup: '' as BloodGroup,
        unitsNeeded: 1,
        dateNeeded: '',
        hospitalName: '',
        hospitalAddress: '',
        urgencyLevel: '' as UrgencyLevel,
        notes: '',
        contactName: '',
        contactPhone: '',
        location: {
            latitude: 0,
            longitude: 0,
            address: ''
        },
        city: '',
        zipcode: ''
    });

    // Prefill the contact with the signed-in user's details once they load.
    useEffect(() => {
        if (!user) return;
        setFormData(prev => ({
            ...prev,
            contactName: prev.contactName || user.full_name || '',
            contactPhone: prev.contactPhone || user.phone || '',
        }));
    }, [user]);

    // People without an account verify with a one-time email code inside the form.
    const [verifyEmail, setVerifyEmail] = useState('');
    const [codeSent, setCodeSent] = useState(false);
    const [code, setCode] = useState('');
    const [verifyBusy, setVerifyBusy] = useState(false);
    const [verifiedUserId, setVerifiedUserId] = useState<string | null>(null);
    const userId = user?.id ?? verifiedUserId;

    const sendCode = async () => {
        setError('');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifyEmail)) {
            setError('Enter a valid email address to get a code.');
            return;
        }
        setVerifyBusy(true);
        const { error: otpError } = await supabase.auth.signInWithOtp({
            email: verifyEmail,
            options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/requests/new` },
        });
        setVerifyBusy(false);
        if (otpError) {
            setError(otpError.message);
            return;
        }
        setCodeSent(true);
        toast.success('Code sent', { description: `Check ${verifyEmail}. It can take a minute.` });
    };

    const confirmCode = async () => {
        setError('');
        setVerifyBusy(true);
        const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({ email: verifyEmail, token: code, type: 'email' });
        setVerifyBusy(false);
        if (otpError || !otpData.user) {
            setError('That code didn’t work. Check it, or send a new one.');
            return;
        }
        setVerifiedUserId(otpData.user.id);
    };

    if (loading) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
            </div>
        );
    }

    const hasLocation = formData.location.latitude !== 0 || formData.location.longitude !== 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) {
            setError('Verify your email below before posting.');
            return;
        }
        if (!hasLocation) {
            setError('Drop a pin on the map (or use your location) so nearby donors can find the hospital.');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            // First-time requesters need a profile row (requests reference it).
            // They're marked as non-donors until they choose to register as one.
            if (!user) {
                const { data: existing } = await supabase.from('profiles').select('id, blood_group').eq('id', userId).maybeSingle();
                if (!existing?.blood_group) {
                    const { error: profileError } = await supabase.from('profiles').upsert({
                        id: userId,
                        email: verifyEmail,
                        full_name: formData.contactName,
                        phone: formData.contactPhone,
                        is_donor: false,
                        is_available: false,
                    }, { onConflict: 'id' });
                    if (profileError) throw profileError;
                }
            }

            const { data, error: requestError } = await supabase
                .from('blood_requests')
                .insert({
                    user_id: userId,
                    blood_group: formData.bloodGroup,
                    units_needed: formData.unitsNeeded,
                    date_needed: formData.dateNeeded,
                    hospital_name: formData.hospitalName,
                    hospital_address: formData.hospitalAddress,
                    urgency_level: formData.urgencyLevel,
                    notes: formData.notes,
                    contact_name: formData.contactName,
                    location: formData.location,
                    city: formData.city,
                    zipcode: formData.zipcode,
                    status: 'active'
                })
                .select(); // Ensure the inserted data is returned

            if (requestError) throw requestError;
            const requestId = data?.[0]?.id;

            // The phone lives in request_contacts so only the requester and
            // donors who offer can read it.
            const { error: contactError } = await supabase
                .from('request_contacts')
                .insert({ request_id: requestId, contact_phone: formData.contactPhone });
            if (contactError) {
                await supabase.from('blood_requests').delete().eq('id', requestId);
                throw contactError;
            }



            // ... inside component ...

            // Trigger Push Notifications (Fire and Forget)
            // The server loads the request itself and checks it belongs to us.
            fetch('/api/notify/donors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId })
            }).catch(e => console.error('Notification trigger failed', e));

            // Log Activity
            await logActivity({
                userId,
                action: 'CREATE_REQUEST',
                entityType: 'blood_requests',
                entityId: requestId,
                metadata: {
                    bloodGroup: formData.bloodGroup,
                    city: formData.city,
                    units: formData.unitsNeeded
                }
            });

            toast.success('Request posted', {
                description: `Compatible donors in ${formData.city} are being alerted. Share it on WhatsApp to reach more people.`
            });

            router.push(requestId ? `/requests/${requestId}` : '/requests');
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

    const section = (n: string, title: string, children: React.ReactNode) => (
        <section className="grid gap-6 border-t border-gray-200 py-8 md:grid-cols-3 md:gap-10">
            <div>
                <p className="font-mono text-xs text-red-600">{n}</p>
                <h2 className="mt-2 font-medium text-gray-900">{title}</h2>
            </div>
            <div className="space-y-4 md:col-span-2">{children}</div>
        </section>
    );

    return (
        <div className="mx-auto max-w-4xl">
            <header className="pb-8">
                <p className="eyebrow">New request</p>
                <h1 className="display mt-3 text-5xl leading-none">Ask for blood.</h1>
                <p className="mt-4 max-w-xl leading-relaxed text-gray-600">
                    Once posted, registered donors in the same city with a compatible blood group are alerted by push and email.
                    You’ll get a link to share as well.
                </p>
            </header>

            {error && <Alert variant="error" className="mb-6" onClose={() => setError('')}>{error}</Alert>}

            <form onSubmit={handleSubmit}>
                {section('01', 'What’s needed', <>
                    <div>
                        <p className="mb-1.5 text-[13px] font-medium text-gray-800">Blood group</p>
                        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Blood group">
                            {BLOOD_GROUPS.map(g => (
                                <button
                                    key={g}
                                    type="button"
                                    role="radio"
                                    aria-checked={formData.bloodGroup === g}
                                    onClick={() => setFormData({ ...formData, bloodGroup: g })}
                                    className={`h-12 rounded-md border font-serif text-2xl transition-colors ${formData.bloodGroup === g ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'}`}
                                >
                                    {formatBloodGroup(g)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input
                            type="number"
                            label="Units needed"
                            min={1}
                            max={20}
                            value={formData.unitsNeeded}
                            onChange={(e) => setFormData({ ...formData, unitsNeeded: Math.max(1, parseInt(e.target.value) || 1) })}
                            required
                        />
                        <Input
                            type="date"
                            label="Needed by"
                            value={formData.dateNeeded}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setFormData({ ...formData, dateNeeded: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <p className="mb-1.5 text-[13px] font-medium text-gray-800">Urgency</p>
                        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Urgency">
                            {([['High', 'Urgent', 'Today'], ['Medium', 'Soon', 'In a few days'], ['Low', 'Planned', 'Scheduled']] as const).map(([value, label, hint]) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="radio"
                                    aria-checked={formData.urgencyLevel === value}
                                    onClick={() => setFormData({ ...formData, urgencyLevel: value })}
                                    className={`rounded-md border px-3 py-2.5 text-left transition-colors ${formData.urgencyLevel === value ? (value === 'High' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-900 bg-gray-900 text-white') : 'border-gray-300 bg-white text-gray-900 hover:border-gray-400'}`}
                                >
                                    <span className="block text-sm font-medium">{label}</span>
                                    <span className={`block text-xs ${formData.urgencyLevel === value ? 'opacity-70' : 'text-gray-500'}`}>{hint}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </>)}

                {section('02', 'Where', <>
                    <Input label="Hospital" value={formData.hospitalName} onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })} required placeholder="e.g. General Hospital" />
                    <Input label="Address" value={formData.hospitalAddress} onChange={(e) => setFormData({ ...formData, hospitalAddress: e.target.value })} required />
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="City" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} required placeholder="e.g. Kochi" helperText="Donors in this city are alerted." />
                        <Input label="PIN code" inputMode="numeric" value={formData.zipcode} onChange={(e) => setFormData({ ...formData, zipcode: e.target.value })} required placeholder="e.g. 682011" />
                    </div>
                    <div>
                        <div className="mb-1.5 flex items-center justify-between">
                            <p className="text-[13px] font-medium text-gray-800">Pin the hospital on the map</p>
                            <button type="button" onClick={handleGetLocation} className="inline-flex items-center gap-1 text-[13px] text-gray-600 hover:text-gray-900">
                                <MapPin className="h-3.5 w-3.5" /> Use my location
                            </button>
                        </div>
                        <div className={`relative z-0 h-[300px] overflow-hidden rounded-md border ${hasLocation ? 'border-gray-300' : 'border-dashed border-gray-400'}`}>
                            <Map
                                interactive={true}
                                center={hasLocation ? { lat: formData.location.latitude, lng: formData.location.longitude } : { lat: 20.5937, lng: 78.9629 }}
                                zoom={hasLocation ? 14 : 5}
                                selectedPosition={hasLocation ? { lat: formData.location.latitude, lng: formData.location.longitude } : null}
                                markers={[]}
                                onLocationSelect={(loc) => setFormData(prev => ({ ...prev, location: { ...prev.location, latitude: loc.lat, longitude: loc.lng } }))}
                            />
                        </div>
                        <p className="mt-1.5 font-mono text-[11px] text-gray-500">
                            {hasLocation
                                ? `${formData.location.latitude.toFixed(4)}, ${formData.location.longitude.toFixed(4)}`
                                : 'Tap the map to drop a pin'}
                        </p>
                    </div>
                </>)}

                {section('03', 'Who to call', <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Contact name" value={formData.contactName} onChange={(e) => setFormData({ ...formData, contactName: e.target.value })} required />
                        <Input label="Contact phone" type="tel" value={formData.contactPhone} onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })} required helperText="Only shown to donors who offer." />
                    </div>
                    <Textarea
                        label="Anything donors should know (optional)"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Ward number, patient’s condition, best time to call…"
                    />
                </>)}

                {!user && section('04', 'Verify it’s you', <>
                    {verifiedUserId ? (
                        <p className="flex items-center gap-2 text-sm text-success-700">
                            <span className="h-2 w-2 rounded-full bg-success-500" /> Verified as {verifyEmail}. You can post now.
                        </p>
                    ) : (
                        <>
                            <p className="text-sm leading-relaxed text-gray-600">
                                No account needed. We’ll email you a one-time code; that also lets you manage this request later.
                                Already registered? <Link href="/login?redirect=/requests/new" className="text-gray-900 underline decoration-gray-300 underline-offset-4">Sign in</Link>.
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                <div className="flex-1">
                                    <Input label="Your email" type="email" autoComplete="email" value={verifyEmail} onChange={(e) => setVerifyEmail(e.target.value)} disabled={codeSent} />
                                </div>
                                <Button type="button" variant="secondary" onClick={codeSent ? () => { setCodeSent(false); setCode(''); } : sendCode} isLoading={verifyBusy && !codeSent}>
                                    {codeSent ? 'Change email' : 'Send code'}
                                </Button>
                            </div>
                            {codeSent && (
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                                    <div className="flex-1">
                                        <Input
                                            label="Code from the email"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                            className="font-mono tracking-[0.3em]"
                                        />
                                    </div>
                                    <Button type="button" variant="ink" onClick={confirmCode} isLoading={verifyBusy} disabled={code.length < 6}>
                                        Verify
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </>)}

                <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-6 sm:flex-row sm:justify-end">
                    <Button type="button" variant="ghost" onClick={() => router.push('/requests')}>Cancel</Button>
                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        isLoading={isLoading}
                        disabled={!formData.bloodGroup || !formData.urgencyLevel || !userId}
                    >
                        Post request
                    </Button>
                </div>
            </form>
        </div>
    );
}
