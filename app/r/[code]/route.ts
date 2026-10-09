import { NextResponse, type NextRequest } from 'next/server';
import { normaliseReferralCode } from '@/lib/referrals';

// vitalapp.in/r/ASHA482 -> the register page, carrying the code. The register
// page remembers it until registration is complete; the database decides
// whether it counts (see claim_referral).
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const valid = normaliseReferralCode(decodeURIComponent(code));
    const target = new URL('/register', request.url);
    if (valid) target.searchParams.set('ref', valid);
    return NextResponse.redirect(target, 307);
}
