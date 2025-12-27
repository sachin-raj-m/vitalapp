import { useState, useEffect } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';
import { Search, Users, Calculator, Send, AlertCircle, CheckCircle } from 'lucide-react';

type TargetingMode = 'broadcast' | 'filter' | 'single';

export function AdminNotificationConsole() {
    // Content State
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [url, setUrl] = useState('/');

    // Targeting State
    const [mode, setMode] = useState<TargetingMode>('single');
    const [userId, setUserId] = useState('');
    const [userSearchTerm, setUserSearchTerm] = useState('');

    // Filters
    const [filters, setFilters] = useState({
        bloodGroup: '',
        gender: '',
        minAge: '',
        maxAge: '',
        city: '',
        state: ''
    });

    // Execution State
    const [sending, setSending] = useState(false);
    const [audienceCount, setAudienceCount] = useState<number | null>(null);
    const [calcLoading, setCalcLoading] = useState(false);
    const [progress, setProgress] = useState({ sent: 0, total: 0, failed: 0 });
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

    // Persistence Key
    const STORAGE_KEY = 'admin_notification_draft';

    // Load draft on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const draft = JSON.parse(saved);
                setTitle(draft.title || '');
                setBody(draft.body || '');
                setUrl(draft.url || '/');
                setUserId(draft.userId || '');
                setMode(draft.mode || 'single');
                if (draft.filters) setFilters(draft.filters);
            } catch (e) {
                console.error('Failed to parse draft', e);
            }
        }
    }, []);

    // Save draft on change
    useEffect(() => {
        const draft = { title, body, url, userId, mode, filters };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    }, [title, body, url, userId, mode, filters]);

    const calculateAudience = async () => {
        setCalcLoading(true);
        try {
            let query = supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_donor', true);

            if (mode === 'filter') {
                if (filters.bloodGroup) query = query.eq('blood_group', filters.bloodGroup);
                if (filters.gender) query = query.eq('gender', filters.gender);
                if (filters.city) query = query.ilike('city', `%${filters.city}%`);
                if (filters.state) query = query.ilike('state', `%${filters.state}%`);

                if (filters.minAge || filters.maxAge) {
                    const year = new Date().getFullYear();
                    // Age 20 means born around year-20. 
                    // minAge 20 => maxBirthDate = (Year-20)-12-31
                    // maxAge 30 => minBirthDate = (Year-30)-01-01
                    if (filters.minAge) {
                        const maxDob = `${year - parseInt(filters.minAge)}-12-31`;
                        query = query.lte('dob', maxDob);
                    }
                    if (filters.maxAge) {
                        const minDob = `${year - parseInt(filters.maxAge)}-01-01`;
                        query = query.gte('dob', minDob);
                    }
                }
            }

            const { count, error } = await query;
            if (error) throw error;
            setAudienceCount(count || 0);
        } catch (err: any) {
            console.error('Audience Calc Error:', err);
            setStatus({ type: 'error', message: 'Failed to calculate audience' });
        } finally {
            setCalcLoading(false);
        }
    };

    const findUserByEmail = async () => {
        if (!userSearchTerm.includes('@')) {
            setStatus({ type: 'error', message: 'Please enter a valid email to search' });
            return;
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, full_name, email')
                .ilike('email', userSearchTerm)
                .single();

            if (error || !data) {
                setStatus({ type: 'error', message: 'User not found' });
                return;
            }

            setUserId(data.id);
            setStatus({ type: 'success', message: `Selected: ${data.full_name} (${data.email})` });
        } catch (err) {
            setStatus({ type: 'error', message: 'User not found' });
        }
    };

    const handleSend = async () => {
        setSending(true);
        setStatus(null);
        setProgress({ sent: 0, total: 0, failed: 0 });

        try {
            // 1. Resolve Targets
            let targetIds: string[] = [];

            if (mode === 'single') {
                if (!userId && !userSearchTerm) { // Ensure at least one way to ID user
                    // Allow testing sends to self if field is empty
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) targetIds = [user.id];
                } else {
                    if (!userId) await findUserByEmail(); // Try to resolve if only email typed
                    if (userId) targetIds = [userId];
                }
            } else {
                // Fetch User IDs for Bulk (Filter or Broadcast)
                let query = supabase.from('profiles').select('id').eq('is_donor', true);

                if (mode === 'filter') {
                    if (filters.bloodGroup) query = query.eq('blood_group', filters.bloodGroup);
                    if (filters.gender) query = query.eq('gender', filters.gender);
                    if (filters.city) query = query.ilike('city', `%${filters.city}%`);
                    if (filters.state) query = query.ilike('state', `%${filters.state}%`);
                    if (filters.minAge || filters.maxAge) {
                        const year = new Date().getFullYear();
                        if (filters.minAge) query = query.lte('dob', `${year - parseInt(filters.minAge)}-12-31`);
                        if (filters.maxAge) query = query.gte('dob', `${year - parseInt(filters.maxAge)}-01-01`);
                    }
                }

                const { data, error } = await query;
                if (error) throw error;
                targetIds = data.map(p => p.id);
            }

            if (targetIds.length === 0) throw new Error('No eligible users found for this selection.');

            // 2. Batch Send (Pass IDs to API)
            const total = targetIds.length;
            let sentCount = 0;
            let failedCount = 0;

            setProgress(prev => ({ ...prev, total }));

            // Process sequentially or in small parallel batches to update progress
            // API now handles fetching subs, so we just send ID batches.
            // We can send larger batches now since API handles logic, but keep it at ~20 to avoid timeouts.
            const BATCH_SIZE = 20;
            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batchIds = targetIds.slice(i, i + BATCH_SIZE);

                try {
                    const res = await fetch('/api/web-push/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userIds: batchIds, // Pass IDs, API fetches subs with Service Role
                            title,
                            body,
                            url
                        })
                    });

                    const result = await res.json();

                    if (res.ok) {
                        sentCount += (result.sent || 0);
                        failedCount += (result.failed || 0);

                        // If API reports 0 sent but success, it effectively means those users didn't have subs.
                        // We count them as "failed" in terms of "Active Delivery", or we can track "Skipped".
                        // For simplicity, let's treat "no sub found" as failed delivery attempt.
                        if (result.sent === 0 && result.failed === 0) {
                            failedCount += batchIds.length;
                        }
                    } else {
                        failedCount += batchIds.length;
                        console.error('Batch Send Error', result);
                    }
                } catch (e) {
                    failedCount += batchIds.length;
                    console.error('Batch Network Error', e);
                }

                setProgress({ sent: sentCount, failed: failedCount, total });
            }

            setStatus({
                type: sentCount > 0 ? 'success' : 'info',
                message: `Finished: Sent ${sentCount}, Skipped/Failed ${failedCount} (Total Targets: ${total})`
            });

            // Clear draft on success
            if (sentCount > 0) {
                localStorage.removeItem(STORAGE_KEY);
                // Don't clear inputs immediately so admin can see what they sent, or optional.
            }

        } catch (err: any) {
            setStatus({ type: 'error', message: err.message });
        } finally {
            setSending(false);
        }
    };

    return (
        <Card>
            <CardHeader className="bg-gray-50 border-b">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2"><Send size={20} /> Push Console</h2>
                        <p className="text-sm text-gray-500">Send notifications to users instantly.</p>
                    </div>
                    {audienceCount !== null && (
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
                            Est. Audience: {audienceCount}
                        </span>
                    )}
                </div>
            </CardHeader>
            <CardBody className="space-y-6">
                {status && (
                    <Alert variant={status.type as any} onClose={() => setStatus(null)}>
                        {status.message}
                    </Alert>
                )}

                {/* Content Section */}
                <div className="space-y-4 border-b pb-6">
                    <h3 className="font-semibold text-gray-900">1. Message Content</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <Input label="Title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Urgent Request" />
                        <Input label="Deep Link URL" value={url} onChange={e => setUrl(e.target.value)} placeholder="/requests/123" />
                    </div>
                    <Textarea label="Body" value={body} onChange={e => setBody(e.target.value)} placeholder="A+ Blood needed..." />
                </div>

                {/* Targeting Section */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">2. Audience Targeting</h3>

                    <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit">
                        {(['single', 'filter', 'broadcast'] as const).map(m => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${mode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-900'}`}
                            >
                                {m.charAt(0).toUpperCase() + m.slice(1)}
                            </button>
                        ))}
                    </div>

                    {mode === 'single' && (
                        <div className="grid md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-end gap-2">
                                <Input
                                    label="Search by Email"
                                    value={userSearchTerm}
                                    onChange={e => setUserSearchTerm(e.target.value)}
                                    placeholder="user@example.com"
                                    className="w-full"
                                />
                                <Button onClick={findUserByEmail} variant="secondary" className="mb-0.5"><Search size={18} /></Button>
                            </div>
                            <Input
                                label="Or Specific User ID"
                                value={userId}
                                onChange={e => setUserId(e.target.value)}
                                placeholder="UUID..."
                                helperText="Leave empty to send to yourself only."
                            />
                        </div>
                    )}

                    {mode === 'filter' && (
                        <div className="grid md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200 animate-in fade-in slide-in-from-top-2">
                            <Select
                                label="Blood Group"
                                value={filters.bloodGroup}
                                onChange={e => setFilters(prev => ({ ...prev, bloodGroup: e.target.value }))}
                                options={['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(v => ({ value: v, label: v || 'Any' }))}
                            />
                            <Select
                                label="Gender"
                                value={filters.gender}
                                onChange={e => setFilters(prev => ({ ...prev, gender: e.target.value }))}
                                options={[{ value: '', label: 'Any' }, { value: 'Male', label: 'Male' }, { value: 'Female', label: 'Female' }]}
                            />
                            <div className="flex gap-2">
                                <Input
                                    label="Min Age"
                                    type="number"
                                    value={filters.minAge}
                                    onChange={e => setFilters(prev => ({ ...prev, minAge: e.target.value }))}
                                    placeholder="18"
                                />
                                <Input
                                    label="Max Age"
                                    type="number"
                                    value={filters.maxAge}
                                    onChange={e => setFilters(prev => ({ ...prev, maxAge: e.target.value }))}
                                    placeholder="65"
                                />
                            </div>
                            <Input
                                label="City"
                                value={filters.city}
                                onChange={e => setFilters(prev => ({ ...prev, city: e.target.value }))}
                                placeholder="e.g. Kochi"
                            />
                            <Input
                                label="State"
                                value={filters.state}
                                onChange={e => setFilters(prev => ({ ...prev, state: e.target.value }))}
                                placeholder="e.g. Kerala"
                            />
                            <div className="flex items-end">
                                <Button
                                    variant="outline"
                                    onClick={calculateAudience}
                                    isLoading={calcLoading}
                                    className="w-full"
                                    leftIcon={<Calculator size={16} />}
                                >
                                    Calculate Audience
                                </Button>
                            </div>
                        </div>
                    )}

                    {mode === 'broadcast' && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-800 text-sm flex items-start gap-2">
                            <AlertCircle size={20} className="shrink-0 mt-0.5" />
                            <div>
                                <strong className="block font-semibold">Warning: Broadcast Mode</strong>
                                This will send the notification to ALL registered donors who have enabled push notifications. Use with caution.
                                <Button size="sm" variant="ghost" className="mt-2 text-red-700 underline p-0 h-auto" onClick={calculateAudience}>Check Count</Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Progress Bar */}
                {sending && (
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-gray-500">
                            <span>Progress</span>
                            <span>{Math.round((progress.sent + progress.failed) / (progress.total || 1) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div
                                className="bg-blue-600 h-full transition-all duration-300"
                                style={{ width: `${(progress.sent + progress.failed) / (progress.total || 1) * 100}%` }}
                            />
                        </div>
                        <p className="text-xs text-center text-gray-400">
                            Sent: {progress.sent} | Failed: {progress.failed} | Total: {progress.total}
                        </p>
                    </div>
                )}

                <div className="flex justify-end pt-4 border-t">
                    <Button
                        onClick={handleSend}
                        isLoading={sending}
                        disabled={!title || !body}
                        size="lg"
                        className="min-w-[150px]"
                        leftIcon={<Send size={18} />}
                    >
                        {mode === 'broadcast' ? 'Broadcast' : 'Send'}
                    </Button>
                </div>
            </CardBody>
        </Card>
    );
}
