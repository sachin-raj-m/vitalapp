// Checks how WhatsApp messages are read into a blood request draft
// (lib/whatsapp-request-parse.ts). No database or network access.
//
//   npx tsx scripts/check-whatsapp-request-parse.ts

import {
    answerContact, confirmingContact, contactLine, dateQuestion, draftFromFirstMessage, extractPlace, isRequestCommand, looksLikeBloodNeed,
    nextStep, normaliseMessage, parseBloodGroup, parseContact, parseFirstMessage, parseHospitalAnswer, parseMobile, parseName,
    parseNeededBy, parsePin, parseUnits, pastDateIn, placeNeedsTown, readLabelledFields, urgencyFor,
} from '../lib/whatsapp-request-parse';

const TODAY = '2026-10-25';
let failed = 0;
let passed = 0;
function check(label: string, got: unknown, want: unknown) {
    const g = JSON.stringify(got);
    const w = JSON.stringify(want);
    if (g === w) passed++;
    else { failed++; console.log(`FAIL ${label}\n     got  ${g}\n     want ${w}`); }
}

// Blood groups ------------------------------------------------------------
const groups: [string, string | null][] = [
    ['need O+ blood', 'O+'],
    ['O +ve', 'O+'],
    ['o+ve urgent', 'O+'],
    ['O positive', 'O+'],
    ['O Positive blood required', 'O+'],
    ['o pos', 'O+'],
    ['0+ blood', 'O+'],
    ['0 negative', 'O-'],
    ['O-', 'O-'],
    ['O -ve', 'O-'],
    ['O−', 'O-'],
    ['O neg', 'O-'],
    ['B negative 2 units', 'B-'],
    ['B-ve', 'B-'],
    ['B (-ve)', 'B-'],
    ['b(+)', 'B+'],
    ['AB+', 'AB+'],
    ['ab positive', 'AB+'],
    ['AB negative', 'AB-'],
    ['AB -ve', 'AB-'],
    ['A1+', 'A+'],
    ['A1 positive', 'A+'],
    ['A1B negative', 'AB-'],
    ['A2B+', 'AB+'],
    ['A+ve', 'A+'],
    ['a +', 'A+'],
    ['O Rh+', 'O+'],
    ['B Rh negative', 'B-'],
    ['blood group: B+', 'B+'],
    ['Bpositive', 'B+'],
    ['ഒ പോസിറ്റീവ് രക്തം ആവശ്യമുണ്ട്', 'O+'],
    ['ബി നെഗറ്റീവ്', 'B-'],
    ['बी पॉजिटिव खून चाहिए', 'B+'],
    ['O+ खून चाहिए', 'O+'],
    ['B - 2 units', null],
    ['AB- 2 units', 'AB-'],
    ['need O- 1 unit', 'O-'],
    ['O Rh-', 'O-'],
    ['B+2 units', 'B+'],
    ['hello', null],
    ['I am positive about this', null],
    ['go positive', null],
    ['blood needed', null],
    ['Covid positive patient', null],
];
for (const [text, want] of groups) check(`group: ${text}`, parseBloodGroup(text), want);

// Units ---------------------------------------------------------------------
const units: [string, boolean, number | null][] = [
    ['2 units', false, 2],
    ['2units', false, 2],
    ['need 3 bottles', false, 3],
    ['1 unit', false, 1],
    ['two units', false, 2],
    ['a unit of O+', false, 1],
    ['units: 4', false, 4],
    ['4 bags', false, 4],
    ['2 pints', false, 2],
    ['2u', false, 2],
    ['2 യൂണിറ്റ്', false, 2],
    ['3 यूनिट', false, 3],
    ['21 units', false, null],
    ['0 units', false, null],
    ['need O+ blood', false, null],
    ['2', true, 2],
    ['5', true, 5],
    ['20', true, 20],
    ['two', true, 2],
    ['2', false, null],
    ['25', true, null],
    ['abc', true, null],
];
for (const [text, bare, want] of units) check(`units${bare ? ' (bare)' : ''}: ${text}`, parseUnits(text, bare), want);

// PIN codes and numbers -----------------------------------------------------
check('pin: plain', parsePin('Kozhikode 673008'), '673008');
check('pin: with space', parsePin('PIN 673 008'), '673008');
check('pin: inside a phone number', parsePin('call 9876543210'), null);
check('pin: split phone number', parsePin('call 98765 43210'), null);
check('pin: starts with 0', parsePin('012345'), null);
check('pin: none', parsePin('2 units'), null);
check('mobile: 10 digits', parseMobile('9876543210'), '9876543210');
check('mobile: +91 spaced', parseMobile('+91 98765 43210'), '9876543210');
check('mobile: 0 prefix', parseMobile('09876543210'), '9876543210');
check('mobile: 91 prefix', parseMobile('919876543210'), '9876543210');
check('mobile: landline-like', parseMobile('0495 2350000'), null);
check('mobile: too short', parseMobile('98765'), null);

// Dates (today is Sun 25 Oct 2026) -------------------------------------------
const dates: [string, unknown][] = [
    ['today', { date: '2026-10-25' }],
    ['Today', { date: '2026-10-25' }],
    ['urgent', null],
    ['needed now', { date: '2026-10-25' }],
    ['tonight', { date: '2026-10-25' }],
    ['asap', { date: '2026-10-25' }],
    ['ഇന്ന്', { date: '2026-10-25' }],
    ['आज', { date: '2026-10-25' }],
    ['tomorrow', { date: '2026-10-26' }],
    ['tmrw morning', { date: '2026-10-26' }],
    ['nale', { date: '2026-10-26' }],
    ['നാളെ', { date: '2026-10-26' }],
    ['day after tomorrow', { date: '2026-10-27' }],
    ['28-10', { date: '2026-10-28' }],
    ['28/10', { date: '2026-10-28' }],
    ['28.10.2026', { date: '2026-10-28' }],
    ['28/10/26', { date: '2026-10-28' }],
    ['5-11', { date: '2026-11-05' }],
    ['28 Oct', { date: '2026-10-28' }],
    ['28th October', { date: '2026-10-28' }],
    ['Nov 2', { date: '2026-11-02' }],
    ['24-10', { error: 'past' }],
    ['24-10-2026', { error: 'past' }],
    ['02-01', { date: '2027-01-02' }],
    ['31-02', { error: 'invalid' }],
    ['13-13', { error: 'invalid' }],
    ['25-12', { date: '2026-12-25' }],
    ['25-03', { error: 'far' }],
    ['hello', null],
    ['1-2 units', null],
];
for (const [text, want] of dates) check(`date: ${text}`, parseNeededBy(text, TODAY), want);

// Is it a request? ------------------------------------------------------------
const needs: [string, boolean][] = [
    ['need O+ blood', true],
    ['Need O+ve blood urgently', true],
    ['blood required', true],
    ['Blood needed urgently', true],
    ['B negative 2 units at Medical College Kozhikode', true],
    ['urgent AB- 2 units', true],
    ['need AB- 2 units Baby Memorial Hospital tomorrow', true],
    ['O+ 2 units KIMS', true],
    ['looking for A+ donors', true],
    ['Requirement: B+ blood, 3 units, Aster Medcity Kochi', true],
    ['need donors for my father', true],
    ['SOS blood', true],
    ['रक्त की आवश्यकता है', true],
    ['B+ खून चाहिए', true],
    ['ഒ പോസിറ്റീവ് രക്തം ആവശ്യമുണ്ട്', true],
    ['രക്തം വേണം', true],
    ['need platelets', true],
    ['I can donate O+', false],
    ['I want to donate blood', false],
    ['I am willing to donate B+ blood', false],
    ['ready to donate', false],
    ['hello', false],
    ['STOP', false],
    ['1234', false],
    ['thanks', false],
    ['I need help with login', false],
    ['O+', false],
];
for (const [text, want] of needs) check(`need: ${text}`, looksLikeBloodNeed(text), want);
check('command: REQUEST', isRequestCommand('REQUEST'), true);
check('command: request blood', isRequestCommand('request blood'), true);
check('command: new request', isRequestCommand('new request'), true);
check('command: need blood', isRequestCommand('Need blood'), true);
check('command: not a sentence', isRequestCommand('request status of my offer'), false);

// Places in the first message -----------------------------------------------
const places: [string, unknown][] = [
    ['B negative 2 units at Medical College Kozhikode', { hospital: 'Medical College Kozhikode', town: null }],
    ['need O+ at KIMS in Trivandrum', { hospital: 'KIMS', town: 'Trivandrum' }],
    ['Need O+ blood, 2 units, Govt Medical College, Kozhikode', { hospital: 'Govt Medical College', town: 'Kozhikode' }],
    ['urgent A+ blood needed @ Aster Medcity', { hospital: 'Aster Medcity', town: null }],
    ['AB+ve 3 bottles KIMS hospital Trivandrum tomorrow', { hospital: 'KIMS hospital Trivandrum', town: null }],
    ['need O+ blood', null],
    ['need O+ blood in Kochi', null],
    ['B+ blood required for patient admitted in Lisie Hospital, Ernakulam. Contact 9876543210', { hospital: 'Lisie Hospital', town: 'Ernakulam' }],
];
for (const [text, want] of places) check(`place: ${text}`, extractPlace(text), want);

const answers: [string, unknown][] = [
    ['Govt Medical College, Kozhikode', { hospital: 'Govt Medical College', town: 'Kozhikode', pin: null }],
    ['KIMS Trivandrum 695029', { hospital: 'KIMS Trivandrum', town: null, pin: '695029' }],
    ['673008', { hospital: null, town: null, pin: '673008' }],
    ['Aster Medcity, Kochi 682027', { hospital: 'Aster Medcity', town: 'Kochi', pin: '682027' }],
    ['https://maps.app.goo.gl/xyz', null],
    ['??', null],
    ['ab', null],
];
for (const [text, want] of answers) check(`hospital answer: ${text}`, parseHospitalAnswer(text), want);
check('needs town: Medical College', placeNeedsTown('Medical College'), true);
check('needs town: Govt Hospital', placeNeedsTown('Govt Hospital'), true);
check('needs town: KIMS', placeNeedsTown('KIMS'), false);
check('needs town: Medical College Kozhikode', placeNeedsTown('Medical College Kozhikode'), false);

// Names ----------------------------------------------------------------------
check('name: Riya', parseName('Riya'), 'Riya');
check('name: with initial', parseName('K. P. Anil'), 'K. P. Anil');
check('name: Malayalam', parseName('രാജു'), 'രാജു');
check('name: digits', parseName('Riya 98765'), null);
check('name: one letter', parseName('R'), null);
check('name: link', parseName('http://x.y'), null);

// First message to draft --------------------------------------------------------
check('first: full', parseFirstMessage('B negative 2 units at Medical College Kozhikode today', TODAY),
    { bloodGroup: 'B-', units: 2, dateNeeded: '2026-10-25', hospital: 'Medical College Kozhikode', town: null });
check('first: group only', parseFirstMessage('need O+ blood', TODAY), { bloodGroup: 'O+' });
check('first: with PIN', parseFirstMessage('A+ 1 unit Baby Memorial Hospital 673004 tomorrow', TODAY),
    { bloodGroup: 'A+', units: 1, dateNeeded: '2026-10-26', hospital: 'Baby Memorial Hospital', town: null, pin: '673004' });
check('first: past date ignored', parseFirstMessage('O+ needed 20-10', TODAY), { bloodGroup: 'O+' });
check('next step: empty', nextStep({}), 'blood_group');
check('next step: no place yet', nextStep({ bloodGroup: 'O+', units: 2, hospital: 'KIMS' }), 'hospital');
check('urgency: today', urgencyFor('2026-10-25', TODAY), 'High');
check('urgency: in 3 days', urgencyFor('2026-10-28', TODAY), 'Medium');
check('urgency: next week', urgencyFor('2026-11-01', TODAY), 'Low');

// Forwarded posts ("Label : value" lines) ------------------------------------------
const EXAMPLE = `🛑🛑🛑🛑🛑🛑🛑🛑🛑🛑URGENT BLOOD NEEDED
===================
*Blood Group* : AB +ve
*Date of Surgery* : 20 Oct 26
*Hospital* : Jubilee Hospital
*Bystander Name and Contact*:
Meenu Juseph
+91 70344 52570
🔴🔴🔴🔴🔴🔴🔴🔴🔴🔴`;
check('normalise: emoji, bold, rule line', normaliseMessage(EXAMPLE).split('\n').slice(0, 3),
    ['URGENT BLOOD NEEDED', 'Blood Group : AB +ve', 'Date of Surgery : 20 Oct 26']);
check('normalise: zero-width, _italic_, ~strike~', normaliseMessage('​_Urgent_ ~blood~ \u{1FA78}\n---\n*O+*'), 'Urgent blood\nO+');
check('labelled: fields of the example', readLabelledFields(EXAMPLE),
    { fields: { group: 'AB +ve', date: '20 Oct 26', hospital: 'Jubilee Hospital', contact: 'Meenu Juseph\n+91 70344 52570' }, count: 4, rest: ['URGENT BLOOD NEEDED'] });
check('forwarded: the example', parseFirstMessage(EXAMPLE, TODAY), {
    bloodGroup: 'AB+', pastDate: '2026-10-20', hospital: 'Jubilee Hospital', town: null,
    contactName: 'Meenu Juseph', contactPhone: '7034452570', urgent: true,
});
check('forwarded: the example is a request', looksLikeBloodNeed(EXAMPLE), true);
check('forwarded: Jubilee Hospital needs a town', placeNeedsTown('Jubilee Hospital', true), true);

const forwarded: [string, string, unknown][] = [
    ['Malayalam/English mix, B -ve, 2 units, patient name', `🩸 *അത്യാവശ്യം രക്തം ആവശ്യമുണ്ട്* 🩸
Patient Name: Rajan K
Blood Group: B -ve
Units: 2 units
Hospital: Govt Medical College, Kottayam
Date: 27/10/2026
Contact: Suresh - 9847012345`, {
        bloodGroup: 'B-', units: 2, dateNeeded: '2026-10-27', hospital: 'Govt Medical College', town: 'Kottayam',
        contactName: 'Suresh', contactPhone: '9847012345', patientName: 'Rajan K', urgent: true,
    }],
    ['O POSITIVE, bottles, PIN in the address, Ph:', `*BLOOD REQUIREMENT*
Group : O POSITIVE
No. of bottles : 3
Hospital : Aster MIMS
Address : Mini bypass road, Kozhikode 673016
Required on : tomorrow
Contact person: Anu
Ph: 94470 54321`, {
        bloodGroup: 'O+', units: 3, dateNeeded: '2026-10-26', hospital: 'Aster MIMS', town: 'Kozhikode', pin: '673016',
        contactName: 'Anu', contactPhone: '9447054321',
    }],
    ['number before name, Venue and Place', `Blood group:- A+ve
Quantity:- 4 units
Venue:- KIMS Hospital
Place:- Trivandrum
Bystander:
9846011122
Rahul (brother)`, {
        bloodGroup: 'A+', units: 4, hospital: 'KIMS Hospital', town: 'Trivandrum', contactName: 'Rahul', contactPhone: '9846011122',
    }],
    ['two numbers: the first', `_Emergency_
Blood Group : AB-
Needed by : 28th October
Hospital : Lisie Hospital, Ernakulam
Contact : Fathima 98950 12345 / 90370 11111`, {
        bloodGroup: 'AB-', dateNeeded: '2026-10-28', hospital: 'Lisie Hospital', town: 'Ernakulam',
        contactName: 'Fathima', contactPhone: '9895012345', urgent: true,
    }],
    ['patient and Name: the patient is never the contact; remarks without the number', `Patient: Mary Thomas
Blood group: O-
Hospital: Caritas Hospital Kottayam
Date: innu
Name: Joseph
Mobile: +91-98460-55555
Remarks: Bypass surgery, call after 9 am 9846055555`, {
        bloodGroup: 'O-', dateNeeded: '2026-10-25', hospital: 'Caritas Hospital Kottayam', town: null,
        contactName: 'Joseph', contactPhone: '9846055555', patientName: 'Mary Thomas', notes: 'Bypass surgery, call after 9 am',
    }],
    ['past numeric date, district, 0-prefixed number before the name', `URGENT
Blood Group: B+
Date: 20-10-2026
Hospital: Amala Hospital
District: Thrissur
Contact: 07012345678 Sreeja`, {
        bloodGroup: 'B+', pastDate: '2026-10-20', hospital: 'Amala Hospital', town: 'Thrissur',
        contactName: 'Sreeja', contactPhone: '7012345678', urgent: true,
    }],
    ['O Positive, dd.mm.yy, PIN label', `Blood Group : O Positive
Date : 30.10.26
Hospital : Baby Memorial Hospital
PIN : 673004
Contact : Arjun 9895123456`, {
        bloodGroup: 'O+', dateNeeded: '2026-10-30', hospital: 'Baby Memorial Hospital', town: null, pin: '673004',
        contactName: 'Arjun', contactPhone: '9895123456',
    }],
    ['Malayalam labels, nale', `രക്ത ഗ്രൂപ്പ്: ഒ പോസിറ്റീവ്
ആശുപത്രി: മെഡിക്കൽ കോളേജ്, തൃശൂർ
തീയതി: നാളെ
ബന്ധപ്പെടുക: 9447112233`, {
        bloodGroup: 'O+', dateNeeded: '2026-10-26', hospital: 'മെഡിക്കൽ കോളേജ്', town: 'തൃശൂർ', contactPhone: '9447112233',
    }],
    ['~strike~, two units, Oct 29, Contact No / Contact Name', `~Blood needed~
BG: B+ve
Units required: two
Date: Oct 29
Hospital: Sunrise Hospital, Kakkanad
Contact No: 9746123456
Contact Name: Nikhil`, {
        bloodGroup: 'B+', units: 2, dateNeeded: '2026-10-29', hospital: 'Sunrise Hospital', town: 'Kakkanad',
        contactName: 'Nikhil', contactPhone: '9746123456',
    }],
    ['name and two numbers on their own lines', `Required blood: A negative
No of units: 1
Hospital name: Jubilee Mission Medical College
Contact:
Priya
8086112233
9995112233`, {
        bloodGroup: 'A-', units: 1, hospital: 'Jubilee Mission Medical College', town: null, contactName: 'Priya', contactPhone: '8086112233',
    }],
    ['bullets, bottles, Ph. and a footer', `• Blood Group: B Positive
• Bottles: 2
• Hospital: Rajagiri Hospital, Aluva
• Date: 26/10/26
• Bystander Name: Akhil
• Ph. 8547 123 456
Please share 🙏`, {
        bloodGroup: 'B+', units: 2, dateNeeded: '2026-10-26', hospital: 'Rajagiri Hospital', town: 'Aluva',
        contactName: 'Akhil', contactPhone: '8547123456',
    }],
    ['Hindi labels', `ब्लड ग्रुप: A+
यूनिट: 2
अस्पताल: AIIMS, New Delhi
तारीख: 27-10
संपर्क: रवि 9810012345`, {
        bloodGroup: 'A+', units: 2, dateNeeded: '2026-10-27', hospital: 'AIIMS', town: 'New Delhi', contactName: 'रवि', contactPhone: '9810012345',
    }],
];
for (const [label, text, want] of forwarded) {
    check(`forwarded: ${label}`, parseFirstMessage(text, TODAY), want);
    check(`forwarded is a request: ${label}`, looksLikeBloodNeed(text), true);
}
// One labelled line is not a forwarded post: read as before.
check('forwarded: one label reads as before', parseFirstMessage('Blood group: B+ 2 units at KIMS in Trivandrum', TODAY),
    { bloodGroup: 'B+', units: 2, hospital: 'KIMS', town: 'Trivandrum' });

// Contact blocks
const contacts: [string, unknown][] = [
    ['Meenu Juseph\n+91 70344 52570', { name: 'Meenu Juseph', phone: '7034452570' }],
    ['Meenu Juseph - 7034452570', { name: 'Meenu Juseph', phone: '7034452570' }],
    ['Ph: 98470 12345 (Ravi)', { name: 'Ravi', phone: '9847012345' }],
    ['Ravi (brother) 9847012345 / 9447054321', { name: 'Ravi', phone: '9847012345' }],
    ['9847012345', { name: null, phone: '9847012345' }],
    ['Anil', { name: 'Anil', phone: null }],
];
for (const [text, want] of contacts) check(`contact: ${JSON.stringify(text)}`, parseContact(text), want);

// Dates in forwarded posts (today is Sun 25 Oct 2026)
const moreDates: [string, unknown, string | null][] = [
    ['20 Oct 26', { error: 'past' }, '2026-10-20'],
    ['28 Oct 26', { date: '2026-10-28' }, null],
    ['20-10-2026', { error: 'past' }, '2026-10-20'],
    ['20/10/26', { error: 'past' }, '2026-10-20'],
    ['20.10.26', { error: 'past' }, '2026-10-20'],
    ['Oct 20', { error: 'past' }, '2026-10-20'],
    ['20th October', { error: 'past' }, '2026-10-20'],
    ['28 Oct 10 am', { date: '2026-10-28' }, null],
    ['innu', { date: '2026-10-25' }, null],
    ['nale', { date: '2026-10-26' }, null],
    ['tomorrow', { date: '2026-10-26' }, null],
];
for (const [text, want, past] of moreDates) {
    check(`date: ${text}`, parseNeededBy(text, TODAY), want);
    check(`past date: ${text}`, pastDateIn(text, TODAY), past);
}

// Brand names alone need a town
check('needs town (brands): KIMS', placeNeedsTown('KIMS', true), true);
check('needs town (brands): St. Thomas Hospital', placeNeedsTown('St. Thomas Hospital', true), true);
check('needs town (brands): Medical College Kozhikode', placeNeedsTown('Medical College Kozhikode', true), false);
check('needs town (brands): KIMS hospital Trivandrum', placeNeedsTown('KIMS hospital Trivandrum', true), false);
check('needs town (brands): Aster Medcity', placeNeedsTown('Aster Medcity', true), false);

// The conversation for the example (lib/whatsapp-request.ts asks what nextStep says) ---
const chat = draftFromFirstMessage(EXAMPLE, TODAY);
check('chat: draft from the example', chat, {
    bloodGroup: 'AB+', pastDate: '2026-10-20', hospital: 'Jubilee Hospital', town: null,
    contactName: 'Meenu Juseph', contactPhone: '7034452570', urgent: true, contactPending: true,
});
check('chat: units asked first', nextStep(chat), 'units');
chat.units = 2;
check('chat: then the town of Jubilee Hospital (no place yet)', nextStep(chat), 'hospital');
chat.town = 'Thrissur';
chat.place = { latitude: 10.5, longitude: 76.2, precision: 'city', label: 'Thrissur', city: 'Thrissur', district: 'Thrissur', state: 'Kerala', zipcode: null };
check('chat: then the date', nextStep(chat), 'date');
check('chat: the date question says the date passed', dateQuestion(chat, TODAY),
    'The date in your message (Tue, 20 Oct) has already passed. When is blood needed now?');
check('chat: date question without a past date', dateQuestion({}, TODAY), 'When is the blood needed by?');
chat.dateNeeded = '2026-10-26';
delete chat.pastDate;
check('chat: then the contact is confirmed', nextStep(chat), 'contact_phone');
check('chat: confirming the contact', confirmingContact(chat), true);
check('chat: contact line', contactLine(chat), 'Contact: Meenu Juseph, +91 70344 52570');
const changed = { ...chat };
check('chat: [Change] understood', answerContact(changed, 'change'), true);
check('chat: [Change] asks the name again', nextStep(changed), 'contact_name');
const typed = { ...chat };
check('chat: typed contact understood', answerContact(typed, 'Ravi 9847012345'), true);
check('chat: typed contact replaces it', [typed.contactName, typed.contactPhone, nextStep(typed)], ['Ravi', '9847012345', 'confirm']);
check('chat: unclear answer asks again', answerContact({ ...chat }, 'hmm'), false);
check('chat: [Use this] understood', answerContact(chat, 'use'), true);
check('chat: [Use this] then the summary', nextStep(chat), 'confirm');
check('chat: urgent and needed tomorrow is High', urgencyFor(chat.dateNeeded!, TODAY), 'High');
check('chat: free text keeps a past date to say so', draftFromFirstMessage('O+ needed 20-10', TODAY), { bloodGroup: 'O+', pastDate: '2026-10-20' });
check('chat: contact only from free text is not pending', draftFromFirstMessage('need O+ blood', TODAY), { bloodGroup: 'O+' });

console.log(failed ? `\n${failed} failed, ${passed} passed` : `All ${passed} checks passed`);
process.exit(failed ? 1 : 0);
