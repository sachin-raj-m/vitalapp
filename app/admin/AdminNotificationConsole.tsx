import { useState } from 'react';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { supabase } from '@/lib/supabase';

export function AdminNotificationConsole() {
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [url, setUrl] = useState('/');
    const [userId, setUserId] = useState(''); // Optional: Target specific user
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    const handleSend = async () => {
        setSending(true);
        setStatus(null);

        try {
            let targetSubscription = null;

            if (userId) {
                // Fetch specific user's subscription
                const { data, error } = await supabase
                    .from('push_subscriptions')
                    .select('subscription')
                    .eq('user_id', userId)
                    .single();

                if (error || !data) throw new Error('User subscription not found');
                targetSubscription = data.subscription;
            } else {
                // For this demo console, we might want to blast everyone or just test.
                // Let's implement specific targeting first for safety, or current admin's sub.
                // FETCH CURRENT USER's SUB for test
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data, error } = await supabase
                        .from('push_subscriptions')
                        .select('subscription')
                        .eq('user_id', user.id)
                        .single();
                    if (data) targetSubscription = data.subscription;
                }
            }

            if (!targetSubscription) {
                throw new Error('No target subscription found. Enable notifications in your profile first.');
            }

            const response = await fetch('/api/web-push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subscription: targetSubscription, // Target specific sub
                    title,
                    body,
                    url
                })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to send');

            setStatus({ type: 'success', message: 'Notification sent successfully!' });
        } catch (err: any) {
            setStatus({ type: 'error', message: err.message });
        } finally {
            setSending(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <h2 className="text-xl font-bold">Push Notification Console</h2>
                <p className="text-sm text-gray-500">Send test notifications to yourself or specific users.</p>
            </CardHeader>
            <CardBody className="space-y-4">
                {status && (
                    <Alert variant={status.type} onClose={() => setStatus(null)}>
                        {status.message}
                    </Alert>
                )}

                <div className="grid gap-4">
                    <Input
                        label="Title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="e.g. Urgent Blood Request"
                    />
                    <Textarea
                        label="Body"
                        value={body}
                        onChange={e => setBody(e.target.value)}
                        placeholder="e.g. A+ needed at City Hospital"
                    />
                    <Input
                        label="Target URL"
                        value={url}
                        onChange={e => setUrl(e.target.value)}
                        placeholder="/requests/123"
                    />
                    <Input
                        label="Target User ID (Optional)"
                        value={userId}
                        onChange={e => setUserId(e.target.value)}
                        placeholder="Leave empty to send to yourself"
                        helperText="If empty, sends to the currently logged-in admin's device."
                    />
                </div>

                <div className="flex justify-end">
                    <Button
                        onClick={handleSend}
                        isLoading={sending}
                        disabled={!title || !body}
                    >
                        Send Notification
                    </Button>
                </div>
            </CardBody>
        </Card>
    );
}
