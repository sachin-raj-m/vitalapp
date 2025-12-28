import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';
export const alt = 'Blood Request Details';
export const size = {
    width: 1200,
    height: 630,
};
export const contentType = 'image/png';

export default async function Image({ params }: { params: { id: string } }) {
    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: request } = await supabase
        .from('blood_requests')
        .select('*')
        .eq('id', params.id)
        .single();

    if (!request) {
        return new ImageResponse(
            (
                <div
                    style={{
                        fontSize: 48,
                        background: 'white',
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#dc2626',
                    }}
                >
                    Vital Blood Network
                </div>
            ),
            { ...size }
        );
    }

    return new ImageResponse(
        (
            <div
                style={{
                    background: 'white',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '60px',
                }}
            >
                {/* Background Pattern */}
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundImage: 'radial-gradient(circle at 25px 25px, #fee2e2 2%, transparent 0%), radial-gradient(circle at 75px 75px, #fee2e2 2%, transparent 0%)',
                        backgroundSize: '100px 100px',
                        opacity: 0.5,
                    }}
                />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: 32, fontWeight: 'bold', color: '#dc2626', marginRight: '10px' }}>Vital</span>
                        <span style={{ fontSize: 32, color: '#64748b' }}>Network</span>
                    </div>
                    <div style={{
                        background: request.urgency_level === 'High' ? '#fee2e2' : '#f1f5f9',
                        color: request.urgency_level === 'High' ? '#dc2626' : '#475569',
                        padding: '10px 24px',
                        borderRadius: '50px',
                        fontSize: 24,
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                    }}>
                        {request.urgency_level} Priority
                    </div>
                </div>

                {/* Main Content */}
                <div style={{ display: 'flex', flex: 1, alignItems: 'center', gap: '60px' }}>

                    {/* Blood Group Badge */}
                    <div style={{
                        width: '240px',
                        height: '240px',
                        background: '#dc2626',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '96px',
                        fontWeight: '900',
                        boxShadow: '0 20px 50px -10px rgba(220, 38, 38, 0.5)'
                    }}>
                        {request.blood_group}
                    </div>

                    {/* Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ fontSize: '64px', fontWeight: 'bold', color: '#0f172a' }}>
                            {request.units_needed} Unit{request.units_needed > 1 ? 's' : ''} Needed
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ fontSize: '32px', color: '#475569', display: 'flex', alignItems: 'center' }}>
                                📍 {request.hospital_name}
                            </div>
                            <div style={{ fontSize: '28px', color: '#64748b' }}>
                                {request.city || 'Local Request'}
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div style={{
                    marginTop: 'auto',
                    background: '#0f172a',
                    color: 'white',
                    padding: '20px 40px',
                    borderRadius: '20px',
                    fontSize: '24px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%'
                }}>
                    Tap to view details & donate
                </div>

            </div>
        ),
        {
            ...size,
        }
    );
}
