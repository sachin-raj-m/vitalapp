import { LegalPage } from '@/components/legal/LegalPage';
import { GRIEVANCE_EMAIL, LEGAL_UPDATED, PLATFORM_DISCLAIMER_LONG } from '@/lib/legal';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
    path: '/safety-guidelines',
    title: 'Safety guidelines',
    description: 'General information on who can donate and how to prepare. Not medical advice; the hospital or blood bank decides.',
});

export default function SafetyPage() {
    return (
        <LegalPage
            title="Safety guidelines"
            updated={LEGAL_UPDATED}
            intro={
                <>
                    <p>
                        This is general information based on India’s National Blood Transfusion Council (NBTC) criteria.
                        They are not medical advice, and Vital does not check whether anyone meets them. The hospital or
                        blood bank always decides who can donate.
                    </p>
                    <p className="mt-4 rounded-md bg-gray-100 px-4 py-3 text-base text-gray-800">{PLATFORM_DISCLAIMER_LONG}</p>
                </>
            }
            sections={[
                {
                    heading: 'Who can donate',
                    body: (
                        <ul>
                            <li>Aged 18 to 65.</li>
                            <li>Weighing at least 45 kg.</li>
                            <li>In good general health on the day.</li>
                            <li>At least 90 days since your last donation (men) or 120 days (women). Vital shows a reminder based on the last donation date you enter.</li>
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
                            <p>If you’re unsure, ask a doctor or the blood bank before you go.</p>
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
                    heading: 'How the app works',
                    body: (
                        <>
                            <ul>
                                <li>Alerts are sent for requests whose blood group matches the group you entered in your profile.</li>
                                <li>Before each offer, you tick a short self-check. It is your own declaration and is not checked by Vital.</li>
                                <li>Your phone number is shown only to the person whose request you offer on.</li>
                                <li>The requester enters your private PIN to mark the donation as completed in Vital. The PIN is checked on our server and is not shown to them.</li>
                            </ul>
                            <p>These are features of the software, not checks on any person. Whether to contact someone, and whether to donate, is your own decision.</p>
                        </>
                    ),
                },
                {
                    heading: 'Things to watch for',
                    body: (
                        <>
                            <ul>
                                <li>Anyone asking for or offering money for blood.</li>
                                <li>Being asked to give blood anywhere other than a hospital or licensed blood bank.</li>
                                <li>Pressure to donate when you don’t meet the criteria.</li>
                            </ul>
                            <p>Use your own judgement. You can always decline, and you can tell us at <a href={`mailto:${GRIEVANCE_EMAIL}`}>{GRIEVANCE_EMAIL}</a> if someone misuses Vital.</p>
                        </>
                    ),
                },
            ]}
        />
    );
}
