import { NextResponse } from 'next/server';
import { getVerifiedUser, serviceClient } from '@/lib/supabase-route';

type Admin = ReturnType<typeof serviceClient>;

/** Thrown when one deletion step fails, so the response can say which. */
class StepError extends Error {
    constructor(public step: string, cause: unknown) {
        super(`${step}: ${cause instanceof Error ? cause.message : String((cause as { message?: string })?.message ?? cause)}`);
    }
}

async function step(name: string, run: () => PromiseLike<{ error: unknown }>) {
    const { error } = await run();
    if (error) throw new StepError(name, error);
}

/** Best-effort removal of uploaded blood-group proofs (stored under `<uid>/`). */
async function removeProofs(admin: Admin, userId: string) {
    try {
        const { data } = await admin.storage.from('proofs').list(userId, { limit: 1000 });
        const paths = (data || []).map(f => `${userId}/${f.name}`);
        if (paths.length) await admin.storage.from('proofs').remove(paths);
    } catch (err) {
        // The bucket may not exist in every environment; never block deletion on it.
        console.warn('Could not remove proof files:', err);
    }
}

/**
 * Deletes the caller's account and everything tied to it. The user is verified
 * with getUser() (a forged session cookie must never reach the service role).
 *
 * Safe to retry: every step deletes "whatever is left", so a request that
 * failed half-way (or whose profile row is already gone) still finishes the
 * job and removes the auth user.
 */
export async function POST(request: Request) {
    const { user } = await getVerifiedUser(request);
    if (!user) {
        return NextResponse.json({ error: 'You need to be signed in to delete your account.' }, { status: 401 });
    }

    const admin = serviceClient();
    const userId = user.id;

    try {
        // Children first, so foreign keys (most are not ON DELETE CASCADE) don't
        // block the profile delete.
        const { data: ownRequests, error: listError } = await admin
            .from('blood_requests')
            .select('id')
            .eq('user_id', userId);
        if (listError) throw new StepError('list requests', listError);

        const requestIds = (ownRequests || []).map(r => r.id as string);
        if (requestIds.length) {
            await step('donations on your requests', () => admin.from('donations').delete().in('request_id', requestIds));
            await step('request contacts', () => admin.from('request_contacts').delete().in('request_id', requestIds));
            await step('blood requests', () => admin.from('blood_requests').delete().in('id', requestIds));
        }
        await step('donation offers', () => admin.from('donations').delete().eq('donor_id', userId));
        await step('alert subscriptions', () => admin.from('push_subscriptions').delete().eq('user_id', userId));
        await step('notifications', () => admin.from('notifications').delete().eq('user_id', userId));
        await step('donor PIN', () => admin.from('donor_secrets').delete().eq('user_id', userId));
        // The FK is ON DELETE SET NULL, which would keep the rows; remove them outright.
        await step('activity log', () => admin.from('user_activity_logs').delete().eq('user_id', userId));
        await removeProofs(admin, userId);

        // Deleting zero rows is not an error, so an already-missing profile is fine.
        await step('profile', () => admin.from('profiles').delete().eq('id', userId));

        const { error: authError } = await admin.auth.admin.deleteUser(userId);
        if (authError && authError.status !== 404) throw new StepError('sign-in account', authError);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting account:', error);
        const failedStep = error instanceof StepError ? error.step : 'unknown step';
        return NextResponse.json(
            {
                error: `We couldn't finish deleting your account (failed at: ${failedStep}). Nothing more was removed after that point. Please try again; if it keeps failing, contact support.`,
                step: failedStep,
            },
            { status: 500 },
        );
    }
}
