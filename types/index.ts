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
  city?: string;
  district?: string;
  permanent_zip?: string;
  present_zip?: string;
  is_donor: boolean;
  is_available: boolean;
  willingness_to_travel?: number;
  last_donation_date?: string;
  availability?: string[];
  has_medical_conditions?: boolean;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  role?: 'user' | 'admin' | string;
  donor_pin?: string;
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
  contact_phone: string;
  location: {
    latitude: number;
    longitude: number;
  };
  city?: string;
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