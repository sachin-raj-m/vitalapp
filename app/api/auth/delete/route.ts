import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const cookieStore = await cookies();

        // Client for verification (using user's cookies)
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;
        console.log(`Requesting deletion for user: ${userId}`);

        // Initialize Service Role Client to perform deletion
        // Note: Using standard supabase-js client for admin operations
        const serviceRoleSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // Delete the user from Supabase Auth (this should cascade to profiles if configured, or leave profile)
        // Ideally we should delete profile row first if no cascade.
        // Let's attempt profile delete first to be clean.
        await serviceRoleSupabase.from('profiles').delete().eq('id', userId);

        const { error: deleteError } = await serviceRoleSupabase.auth.admin.deleteUser(
            userId
        );

        if (deleteError) {
            console.error('Delete User Error:', deleteError);
            throw deleteError;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting account:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete account' },
            { status: 500 }
        );
    }
}
