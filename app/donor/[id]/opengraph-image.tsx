
import { ImageResponse } from 'next/og';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';
export const revalidate = 60;
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: { id: string } }) {
    const { id } = params;

    // Fetch user data
    // Note: In Edge runtime, we need to handle Supabase instance creation carefully or use direct fetch if needed.
    // Assuming supabase-js works in Edge or we use fetch. 
    // Usually supabase-js is Edge compatible.

    let profile = { full_name: 'Hero', blood_group: 'AB+' };

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('full_name, blood_group')
            .eq('id', id)
            .single();

        if (data) profile = data;
    } catch (e) {
        console.error('OG Image Fetch Error', e);
    }

    return new ImageResponse(
        (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(to bottom right, #EF4444, #B91C1C)',
                    color: 'white',
                    fontFamily: 'sans-serif',
                    position: 'relative',
                }}
            >
                {/* Decorative Mesh Circles (Simplified for OG) */}
                <div style={{ position: 'absolute', top: -100, left: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)', filter: 'blur(40px)' }} />
                <div style={{ position: 'absolute', bottom: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: 'rgba(255, 165, 0, 0.2)', filter: 'blur(40px)' }} />

                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'white',
                        borderRadius: 24,
                        padding: '40px 80px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                        border: '4px solid rgba(255,255,255,0.2)'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        <span style={{ fontSize: 24, fontWeight: 900, color: '#DC2626', letterSpacing: '-0.02em' }}>Vital Member</span>
                    </div>

                    <div style={{ fontSize: 96, fontWeight: 900, color: '#1E293B', lineHeight: 1 }}>
                        {profile.blood_group || '?'}
                    </div>

                    <div style={{ fontSize: 20, fontWeight: 700, color: '#64748B', marginTop: 10, letterSpacing: '0.1em' }}>
                        BLOOD GROUP
                    </div>

                    <div style={{ width: '100%', height: 2, background: '#E2E8F0', margin: '30px 0' }} />

                    <div style={{ fontSize: 32, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase' }}>
                        {profile.full_name || 'Anonymous Hero'}
                    </div>
                    <div style={{ fontSize: 16, color: '#64748B', marginTop: 5 }}>
                        Official Verified Donor
                    </div>
                </div>

                <div style={{ position: 'absolute', bottom: 30, opacity: 0.8, fontSize: 18, fontWeight: 600 }}>
                    vitalapp.vercel.app
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
