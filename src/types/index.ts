export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type UrgencyLevel = 'Low' | 'Medium' | 'High';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  blood_group: BloodGroup;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  is_donor: boolean;
  is_available: boolean;
  government_id?: string;
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
  status: 'active' | 'fulfilled' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface Donation {
  id: string;
  donor_id: string;
  request_id: string;
  donation_date: string;
  units: number;
  hospital_name: string;
  status: 'scheduled' | 'completed' | 'cancelled';
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