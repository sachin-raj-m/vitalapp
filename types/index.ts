import type { StoredLocation } from '@/lib/location';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type UrgencyLevel = 'Low' | 'Medium' | 'High';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  dob?: string;
  gender?: string;
  blood_group?: BloodGroup; // Optional
  /** No longer asked: kept equal to the district on save (older profiles: typed). */
  city?: string;
  district?: string;
  state?: string;
  permanent_zip?: string;
  present_zip?: string;
  is_donor: boolean;
  is_available: boolean;
  is_public_profile?: boolean; // New Visibility Toggle
  willingness_to_travel?: number;
  last_donation_date?: string;
  next_eligible_date?: string; // New NBTC Field
  availability?: string[];
  has_medical_conditions?: boolean;
  /**
   * Private to the owner (see lib/location.ts for the stored shape). May be
   * null, or the old {0,0} placeholder: check it with usableLocation().
   */
  location: StoredLocation | null;
  role?: 'user' | 'admin' | string;
  donor_number?: number;
  consent_agreed?: boolean | null;
  consent_at?: string | null;
  consent_version?: string | null;
  whatsapp_alerts?: boolean;
  phone_verified_at?: string | null;
  /** Set when another account verified this profile's number and it was removed here. */
  phone_released_at?: string | null;
  /** Mirrors the sign-in account's email confirmation (set by the database). */
  email_verified_at?: string | null;
  /** Admin's own review of the donor; separate from email/phone verification. */
  verification_status?: string | null;
  blood_group_changed_at?: string | null;
  created_at: string;
}

export interface BloodRequest {
  id: string;
  user_id: string;
  blood_group: BloodGroup;
  units_needed: number;
  hospital_name: string;
  hospital_address: string;
  urgency_level: UrgencyLevel;
  notes?: string;
  contact_name: string;
  /** No longer stored on the request row; read it via the get_request_contact RPC. */
  contact_phone?: string | null;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
    /** How the poster placed the pin: searched, tapped on the map, or their device. */
    source?: 'search' | 'map' | 'gps';
    accuracy_m?: number;
  };
  city?: string;
  /**
   * Listed district and state of the request (lib/india-regions), worked out
   * by the server from its PIN code or city when donors are alerted. Null if unknown.
   */
  district?: string | null;
  state?: string | null;
  zipcode?: string;
  date_needed?: string;
  status: 'active' | 'fulfilled' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Donation {
  id: string;
  request_id: string;
  donor_id: string;
  status: 'pending' | 'completed' | 'cancelled';
  otp?: string;
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  image_url: string;
  points: number;
  criteria: string;
}

export interface Achievement {
  id: string;
  user_id: string;
  badge_id: string;
  earned_date: string;
  badge: Badge;
}

export interface Voucher {
  id: string;
  name: string;
  description: string;
  points_required: number;
  expires_at: string;
  company: string;
  image_url: string;
}