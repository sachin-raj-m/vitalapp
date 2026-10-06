import { LegalPage } from '@/components/legal/LegalPage';
import { GRIEVANCE_EMAIL, LEGAL_UPDATED } from '@/lib/legal';

export const metadata = {
    title: 'Safety guidelines',
    description: 'Who can donate, how to prepare, and how Vital keeps donors and families safe.',
    alternates: { canonical: '/safety-guidelines' },
};

export default function SafetyPage() {
    return (
        <LegalPage
            eyebrow="Safety"
            title={<>Safe for the donor. <em>Safe for the patient.</em></>}
            updated={LEGAL_UPDATED}
            intro={
                <p>
                    These are general guidelines based on India’s National Blood Transfusion Council (NBTC) criteria. The
                    hospital or blood bank always makes the final call on who can donate.
                </p>
            }
            sections={[
                {
                    heading: 'Who can donate',
                    body: (
                        <ul>
                            <li>Aged 18 to 65.</li>
                            <li>Weighing at least 45 kg.</li>
                            <li>In good general health on the day.</li>
                            <li>At least 90 days since your last donation (men) or 120 days (women). Vital tracks this for you.</li>
                        </ul>
                    ),
                },
                {
                    heading: 'Wait before donating if you’ve had',
                    body: (
                        <ul>
                            <li>a cold, flu, sore throat or fever: wait until you’re fully well;</li>
                            <li>antibiotics: 14 days after the last dose;</li>
                            <li>alcohol: 24 hours;</li>
                            <li>a tattoo, piercing or surgery: 12 months;</li>
                            <li>malaria: 3 months after recovery; dengue: 6 months; typhoid: 12 months.</li>
                        </ul>
                    ),
                },
                {
                    heading: 'Don’t donate if',
                    body: (
                        <>
                            <ul>
                                <li>you have ever tested positive for HIV, hepatitis B or hepatitis C;</li>
                                <li>you have heart disease, kidney failure or cancer;</li>
                                <li>you take insulin for diabetes, or have epilepsy;</li>
                                <li>you are pregnant or breastfeeding.</li>
                            </ul>
                            <p>If you’re unsure, ask the blood bank before you go.</p>
                        </>
                    ),
                },
                {
                    heading: 'Before and after',
                    body: (
                        <ul>
                            <li>Sleep at least 5 hours, eat a light meal, and drink about 500 ml of water beforehand.</li>
                            <li>Carry a government photo ID.</li>
                            <li>Afterwards, rest for 10–15 minutes, drink plenty of fluids, and avoid heavy exercise for the day.</li>
                        </ul>
                    ),
                },
                {
                    heading: 'How Vital protects you',
                    body: (
                        <ul>
                            <li>You’re only alerted for blood groups you can actually give to.</li>
                            <li>You confirm a short safety checklist before every offer.</li>
                            <li>Your phone number is shared only with a family you offer to help.</li>
                            <li>Donations are confirmed with your private PIN, checked on our server. The family never sees it.</li>
                        </ul>
                    ),
                },
                {
                    heading: 'Warning signs',
                    body: (
                        <>
                            <ul>
                                <li>Anyone asking for or offering money for blood.</li>
                                <li>Being asked to give blood anywhere other than a hospital or licensed blood bank.</li>
                                <li>Pressure to donate when you don’t meet the criteria.</li>
                            </ul>
                            <p>Walk away and report it to <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a>.</p>
                        </>
                    ),
                },
            ]}
        />
    );
}
