/**
 * India's 28 states and 8 union territories, and their districts, for the
 * State and District dropdowns (components/StateDistrictSelect.tsx).
 *
 * Source: Local Government Directory (LGD, lgdirectory.gov.in), Ministry of
 * Panchayati Raj, via the daily mirror at ramseraph.github.io/opendata/lgd/
 * (states.15Oct2026.csv and districts.15Oct2026.csv). As of 15 October 2026:
 * 36 states/UTs and 784 districts. Licence: Government Open Data License - India.
 *
 * Differences from LGD (lib/india-regions-data.ts is generated, edit with care):
 * - "And" is written "and"; "The Dadra And Nagar Haveli And Daman And Diu" is
 *   "Dadra and Nagar Haveli and Daman and Diu".
 * - A few LGD spellings use the common English name instead (Odisha's
 *   "Kataka" is "Cuttack", "Leh Ladakh" is "Leh"...). See LGD_SPELLINGS; the
 *   LGD spelling is still matched when reading an old value.
 * - Puducherry also lists Mahe and Yanam (districts in the 2011 Census, which
 *   LGD now folds into Puducherry district), so people there can find them.
 *
 * Profiles store the names exactly as listed here, in profiles.state and
 * profiles.district (plain text). Older profiles have hand-typed values:
 * resolveRegion() matches those loosely so the form can preselect them.
 */
import { REGIONS_DATA, LGD_SPELLINGS, type IndiaRegion } from './india-regions-data';

export type { IndiaRegion };

/** All states and UTs, sorted by name. */
export const INDIA_REGIONS: readonly IndiaRegion[] = REGIONS_DATA;

export const STATE_NAMES: readonly string[] = INDIA_REGIONS.map(r => r.name);

export function districtsOf(state: string): readonly string[] {
    return INDIA_REGIONS.find(r => r.name === state)?.districts ?? [];
}

/**
 * Comparison key: lower case, no accents or punctuation, "&" as "and", and
 * without words people add around a name ("district", "dist.", "city", "the").
 * Spaces and hyphens are dropped too, so "Bara Banki" = "Barabanki".
 */
export function regionKey(value: string | null | undefined): string {
    return (value ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .filter(w => w && !['district', 'districts', 'dist', 'distt', 'dt', 'city', 'the'].includes(w))
        .join('');
}

// Other names people type for a state or UT.
const STATE_ALIASES: Record<string, string[]> = {
    'Andaman and Nicobar Islands': ['Andaman', 'Andaman and Nicobar', 'Andaman Nicobar', 'Andamans', 'Andaman Islands', 'Nicobar', 'A and N', 'A and N Islands', 'AN'],
    'Andhra Pradesh': ['AP'],
    'Chhattisgarh': ['Chattisgarh', 'Chhatisgarh', 'Chattisgadh', 'CG'],
    'Chandigarh': ['Chandigarh UT'],
    'Dadra and Nagar Haveli and Daman and Diu': [
        'Dadra and Nagar Haveli', 'Dadra Nagar Haveli', 'Daman and Diu', 'Daman Diu', 'Daman', 'Diu', 'Silvassa',
        'Dadra and Nagar Haveli Daman and Diu', 'DNH', 'DD', 'DNHDD', 'DNH and DD',
    ],
    'Delhi': ['New Delhi', 'NCT', 'NCT of Delhi', 'NCT Delhi', 'Delhi NCT', 'Delhi NCR', 'National Capital Territory of Delhi', 'DL'],
    'Gujarat': ['Gujrat', 'GJ'],
    'Haryana': ['HR'],
    'Himachal Pradesh': ['HP'],
    'Jammu and Kashmir': ['J and K', 'JK', 'Jammu', 'Kashmir', 'Jammu Kashmir', 'Jammu and Kashmir UT'],
    'Karnataka': ['Karnatak', 'Karnatka', 'KA'],
    'Kerala': ['Keralam', 'Kerela', 'KL'],
    'Ladakh': ['Leh', 'Kargil', 'Leh Ladakh', 'Ladak', 'LA'],
    'Lakshadweep': ['Lakshadeep', 'Lakshdweep', 'Laccadives', 'Kavaratti', 'LD'],
    'Madhya Pradesh': ['MP'],
    'Maharashtra': ['Maharastra', 'MH'],
    'Odisha': ['Orissa', 'OD', 'OR'],
    'Puducherry': ['Pondicherry', 'Pondichery', 'Puduchery', 'Pondy', 'PY'],
    'Punjab': ['PB'],
    'Rajasthan': ['RJ'],
    'Tamil Nadu': ['Tamilnadu', 'TN'],
    'Telangana': ['Telengana', 'Telanagana', 'TS', 'TG'],
    'Uttar Pradesh': ['UP'],
    'Uttarakhand': ['Uttaranchal', 'Uttrakhand'],
    'West Bengal': ['WB', 'Bengal'],
};

// Other names people type for a district: old names, city names, spellings.
// Per state, because some names exist in more than one (Aurangabad, Bijapur).
const DISTRICT_ALIASES: Record<string, Record<string, string>> = {
    'Andhra Pradesh': {
        'Anantapur': 'Ananthapuramu', 'Anantapuram': 'Ananthapuramu', 'Nellore': 'Sri Potti Sriramulu Nellore',
        'Kadapa': 'Y.S.R. Kadapa', 'Cuddapah': 'Y.S.R. Kadapa', 'YSR': 'Y.S.R. Kadapa', 'Vijayawada': 'NTR',
        'Vizag': 'Visakhapatnam', 'Vishakhapatnam': 'Visakhapatnam', 'Visakhapatanam': 'Visakhapatnam',
        'Konaseema': 'Dr. B.R. Ambedkar Konaseema', 'Tirupathi': 'Tirupati', 'Puttaparthi': 'Sri Sathya Sai',
        'Rajahmundry': 'East Godavari', 'Rajamahendravaram': 'East Godavari',
    },
    'Andaman and Nicobar Islands': {
        'Port Blair': 'South Andamans', 'Sri Vijaya Puram': 'South Andamans', 'South Andaman': 'South Andamans',
        'North Andaman': 'North and Middle Andaman', 'Middle Andaman': 'North and Middle Andaman', 'Mayabunder': 'North and Middle Andaman',
        'Diglipur': 'North and Middle Andaman', 'Rangat': 'North and Middle Andaman',
        'Nicobar': 'Nicobars', 'Car Nicobar': 'Nicobars',
    },
    'Assam': { 'Guwahati': 'Kamrup Metro', 'Kamrup Metropolitan': 'Kamrup Metro', 'Morigaon': 'Marigaon', 'Karimganj': 'Sribhumi', 'Sibsagar': 'Sivasagar' },
    'Bihar': { 'Kaimur': 'Kaimur (Bhabua)', 'Bhabua': 'Kaimur (Bhabua)', 'Purnea': 'Purnia', 'Motihari': 'East Champaran', 'Bettiah': 'West Champaran' },
    'Chandigarh': { 'Chandigarh UT': 'Chandigarh' },
    'Chhattisgarh': {
        'Kawardha': 'Kabeerdham', 'Kabirdham': 'Kabeerdham', 'Kanker': 'Uttar Bastar Kanker', 'Dantewada': 'Dakshin Bastar Dantewada',
        'Baloda Bazar': 'Balodabazar-Bhatapara', 'Koriya': 'Korea', 'MCB': 'Manendragarh-Chirmiri-Bharatpur',
    },
    'Dadra and Nagar Haveli and Daman and Diu': { 'Silvassa': 'Dadra and Nagar Haveli', 'Dadra Nagar Haveli': 'Dadra and Nagar Haveli', 'DNH': 'Dadra and Nagar Haveli' },
    // "South Delhi" and so on: the district names without "Delhi".
    'Delhi': Object.fromEntries(
        ['Central', 'Central North', 'East', 'North', 'North East', 'North West', 'Outer North', 'South', 'South East', 'South West', 'West']
            .map(d => [`${d} Delhi`, d]),
    ),
    'Goa': { 'Panaji': 'North Goa', 'Panjim': 'North Goa', 'Margao': 'South Goa' },
    'Gujarat': { 'Baroda': 'Vadodara', 'Kutch': 'Kachchh', 'Kachch': 'Kachchh', 'Ahmadabad': 'Ahmedabad', 'Dang': 'Dangs', 'The Dangs': 'Dangs' },
    'Haryana': { 'Gurgaon': 'Gurugram', 'Mewat': 'Nuh' },
    'Himachal Pradesh': { 'Lahul and Spiti': 'Lahaul and Spiti' },
    'Jammu and Kashmir': { 'Badgam': 'Budgam', 'Bandipore': 'Bandipora', 'Shupiyan': 'Shopian', 'Punch': 'Poonch', 'Rajauri': 'Rajouri', 'Baramula': 'Baramulla' },
    'Jharkhand': { 'Jamshedpur': 'East Singhbhum', 'Sahibganj': 'Sahebganj', 'Palamau': 'Palamu', 'Seraikela': 'Saraikela Kharsawan', 'Seraikela Kharsawan': 'Saraikela Kharsawan' },
    'Karnataka': {
        'Bangalore': 'Bengaluru Urban', 'Bangalore Urban': 'Bengaluru Urban', 'Bengaluru': 'Bengaluru Urban',
        'Bangalore Rural': 'Bengaluru Rural', 'Ramanagara': 'Bengaluru South', 'Ramanagaram': 'Bengaluru South',
        'Mysore': 'Mysuru', 'Mangalore': 'Dakshina Kannada', 'Mangaluru': 'Dakshina Kannada', 'South Canara': 'Dakshina Kannada',
        'Belgaum': 'Belagavi', 'Bellary': 'Ballari', 'Gulbarga': 'Kalaburagi', 'Bijapur': 'Vijayapura',
        'Shimoga': 'Shivamogga', 'Tumkur': 'Tumakuru', 'Chikmagalur': 'Chikkamagaluru', 'Chikkamagalur': 'Chikkamagaluru',
        'Hubli': 'Dharwad', 'Hubballi': 'Dharwad', 'Dharwar': 'Dharwad', 'Bagalkot': 'Bagalkote',
        'Chikballapur': 'Chikkaballapura', 'Chikkaballapur': 'Chikkaballapura', 'Davangere': 'Davanagere',
        'Karwar': 'Uttara Kannada', 'North Canara': 'Uttara Kannada', 'Coorg': 'Kodagu', 'Madikeri': 'Kodagu',
        'Hospet': 'Vijayanagara', 'Chamrajnagar': 'Chamarajanagar', 'Yadagiri': 'Yadgir',
    },
    'Kerala': {
        'Trivandrum': 'Thiruvananthapuram', 'TVM': 'Thiruvananthapuram', 'Thiruvanathapuram': 'Thiruvananthapuram', 'Calicut': 'Kozhikode', 'Cochin': 'Ernakulam', 'Kochi': 'Ernakulam',
        'Alleppey': 'Alappuzha', 'Quilon': 'Kollam', 'Trichur': 'Thrissur', 'Palghat': 'Palakkad',
        'Cannanore': 'Kannur', 'Kasargod': 'Kasaragod', 'Kasargode': 'Kasaragod', 'Wynad': 'Wayanad', 'Pathanamthita': 'Pathanamthitta',
    },
    'Ladakh': { 'Ladakh': 'Leh', 'Leh Ladakh': 'Leh' },
    'Lakshadweep': { 'Kavaratti': 'Lakshadweep' },
    'Madhya Pradesh': { 'Hoshangabad': 'Narmadapuram', 'Khandwa': 'Khandwa (East Nimar)', 'East Nimar': 'Khandwa (East Nimar)', 'Khargone': 'Khargone (West Nimar)', 'West Nimar': 'Khargone (West Nimar)', 'Agar Malwa': 'Agar-Malwa' },
    'Maharashtra': {
        'Bombay': 'Mumbai', 'Mumbai City': 'Mumbai', 'Poona': 'Pune', 'Aurangabad': 'Chhatrapati Sambhajinagar',
        'Ahmednagar': 'Ahilyanagar', 'Osmanabad': 'Dharashiv', 'Gondiya': 'Gondia', 'Navi Mumbai': 'Thane', 'Bid': 'Beed',
    },
    'Mizoram': { 'Saiha': 'Siaha' },
    'Odisha': { 'Bhubaneswar': 'Khordha', 'Khurda': 'Khordha', 'Sonepur': 'Subarnapur', 'Bolangir': 'Balangir', 'Nabarangapur': 'Nabarangpur', 'Baudh': 'Boudh', 'Jajapur': 'Jajpur' },
    'Puducherry': { 'Pondicherry': 'Puducherry', 'Pondy': 'Puducherry', 'Mayyazhi': 'Mahe', 'Karikal': 'Karaikal', 'Yanaon': 'Yanam' },
    'Punjab': { 'Mohali': 'S.A.S. Nagar (Mohali)', 'SAS Nagar': 'S.A.S. Nagar (Mohali)', 'Sahibzada Ajit Singh Nagar': 'S.A.S. Nagar (Mohali)', 'Nawanshahr': 'Shahid Bhagat Singh Nagar', 'SBS Nagar': 'Shahid Bhagat Singh Nagar', 'Ropar': 'Rupnagar', 'Firozpur': 'Ferozepur', 'Muktsar': 'Sri Muktsar Sahib' },
    'Rajasthan': { 'Jalor': 'Jalore', 'Chittaurgarh': 'Chittorgarh', 'Dhaulpur': 'Dholpur' },
    'Sikkim': { 'East Sikkim': 'Gangtok', 'West Sikkim': 'Gyalshing', 'North Sikkim': 'Mangan', 'South Sikkim': 'Namchi' },
    'Tamil Nadu': {
        'Madras': 'Chennai', 'Trichy': 'Tiruchirappalli', 'Tiruchirapalli': 'Tiruchirappalli', 'Tuticorin': 'Thoothukkudi',
        'Thoothukudi': 'Thoothukkudi', 'Kanyakumari': 'Kanniyakumari', 'Nilgiris': 'The Nilgiris', 'Ooty': 'The Nilgiris',
        'Kanchipuram': 'Kancheepuram', 'Villupuram': 'Viluppuram', 'Tiruvallur': 'Thiruvallur', 'Tiruvarur': 'Thiruvarur',
        'Sivagangai': 'Sivaganga', 'Tirupur': 'Tiruppur', 'Tirupattur': 'Tirupathur',
    },
    'Telangana': {
        'Warangal Urban': 'Hanumakonda', 'Hanamkonda': 'Hanumakonda', 'Warangal Rural': 'Warangal', 'Rangareddy': 'Ranga Reddy',
        'Secunderabad': 'Hyderabad', 'Medchal': 'Medchal Malkajgiri', 'Malkajgiri': 'Medchal Malkajgiri', 'Yadadri': 'Yadadri Bhuvanagiri',
        'Bhupalpally': 'Jayashankar Bhupalapally', 'Kothagudem': 'Bhadradri Kothagudem', 'Asifabad': 'Kumuram Bheem Asifabad',
        'Sircilla': 'Rajanna Sircilla', 'Gadwal': 'Jogulamba Gadwal', 'Jagtial': 'Jagitial',
    },
    'Uttar Pradesh': {
        'Allahabad': 'Prayagraj', 'Faizabad': 'Ayodhya', 'Noida': 'Gautam Buddha Nagar', 'Gautam Budh Nagar': 'Gautam Buddha Nagar',
        'Greater Noida': 'Gautam Buddha Nagar', 'Kanpur': 'Kanpur Nagar', 'Lakhimpur': 'Lakhimpur Kheri',
        'Sant Ravidas Nagar': 'Bhadohi', 'Banaras': 'Varanasi', 'Benares': 'Varanasi', 'Raebareli': 'Rae Bareli',
        'Badaun': 'Budaun', 'Kushi Nagar': 'Kushinagar',
    },
    'Uttarakhand': { 'Garhwal': 'Pauri Garhwal', 'Pauri': 'Pauri Garhwal', 'Tehri': 'Tehri Garhwal', 'Hardwar': 'Haridwar', 'Dehra Dun': 'Dehradun' },
    'West Bengal': { 'Calcutta': 'Kolkata', 'Darjiling': 'Darjeeling', 'Koch Bihar': 'Cooch Behar', 'Hugli': 'Hooghly', 'Haora': 'Howrah', 'Maldah': 'Malda' },
};

const stateByKey = new Map<string, string>();
const districtByKey = new Map<string, Map<string, string>>();
for (const r of INDIA_REGIONS) {
    stateByKey.set(regionKey(r.name), r.name);
    for (const alias of STATE_ALIASES[r.name] ?? []) stateByKey.set(regionKey(alias), r.name);
    const keys = new Map<string, string>();
    const aliases = { ...LGD_SPELLINGS[r.name], ...DISTRICT_ALIASES[r.name] };
    for (const [alias, name] of Object.entries(aliases)) keys.set(regionKey(alias), name);
    // Real names win over aliases.
    for (const d of r.districts) keys.set(regionKey(d), d);
    districtByKey.set(r.name, keys);
}

/** The listed state or UT for a typed value, or '' if it isn't one. */
export function matchState(value: string | null | undefined): string {
    return stateByKey.get(regionKey(value)) ?? '';
}

/** The listed district of `state` for a typed value, or '' if it isn't one. */
export function matchDistrict(state: string, value: string | null | undefined): string {
    const key = regionKey(value);
    return (key && districtByKey.get(state)?.get(key)) || '';
}

/**
 * Turns a saved (possibly hand-typed) state and district into the listed
 * names, for preselecting the dropdowns. Anything that doesn't match comes
 * back '' so the person picks it: a wrong district is never guessed. When the
 * state is missing or unknown, it is taken from the district only if exactly
 * one state has a district by that name.
 */
export function resolveRegion(state: string | null | undefined, district: string | null | undefined): { state: string; district: string } {
    const s = matchState(state);
    if (s) return { state: s, district: matchDistrict(s, district) };
    if (!regionKey(district)) return { state: '', district: '' };
    const found = INDIA_REGIONS
        .map(r => ({ state: r.name, district: matchDistrict(r.name, district) }))
        .filter(m => m.district);
    return found.length === 1 ? found[0] : { state: '', district: '' };
}
