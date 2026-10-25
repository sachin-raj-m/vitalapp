// Checks how WhatsApp messages are read into a blood request draft
// (lib/whatsapp-request-parse.ts). No database or network access.
//
//   npx tsx scripts/check-whatsapp-request-parse.ts

import {
    extractPlace, isRequestCommand, looksLikeBloodNeed, nextStep, parseBloodGroup, parseFirstMessage,
    parseHospitalAnswer, parseMobile, parseName, parseNeededBy, parsePin, parseUnits, placeNeedsTown, urgencyFor,
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

console.log(failed ? `\n${failed} failed, ${passed} passed` : `All ${passed} checks passed`);
process.exit(failed ? 1 : 0);
