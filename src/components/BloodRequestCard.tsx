import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, Clock, Activity, Droplet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import type { BloodRequest, BloodGroup, UrgencyLevel } from '../types';

interface BloodRequestCardProps {
  request: BloodRequest;
  onRespond?: () => void;
}

const getUrgencyStyles = (urgency: UrgencyLevel) => {
  switch (urgency) {
    case 'High':
      return {
        badgeVariant: 'error' as const,
        cardBorder: 'border-l-4 border-l-error-500',
        animation: 'animate-pulse-urgent',
      };
    case 'Medium':
      return {
        badgeVariant: 'warning' as const,
        cardBorder: 'border-l-4 border-l-warning-500',
        animation: '',
      };
    case 'Low':
      return {
        badgeVariant: 'success' as const,
        cardBorder: 'border-l-4 border-l-success-500',
        animation: '',
      };
    default:
      return {
        badgeVariant: 'neutral' as const,
        cardBorder: '',
        animation: '',
      };
  }
};

const getBloodTypeColor = (bloodType: BloodGroup) => {
  // Blood types with + are warmer colors, - are cooler colors
  switch (bloodType) {
    case 'A+':
      return 'bg-red-100 text-red-800';
    case 'A-':
      return 'bg-red-50 text-red-800';
    case 'B+':
      return 'bg-orange-100 text-orange-800';
    case 'B-':
      return 'bg-orange-50 text-orange-800';
    case 'AB+':
      return 'bg-purple-100 text-purple-800';
    case 'AB-':
      return 'bg-purple-50 text-purple-800';
    case 'O+':
      return 'bg-blue-100 text-blue-800';
    case 'O-':
      return 'bg-blue-50 text-blue-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const BloodRequestCard: React.FC<BloodRequestCardProps> = ({ request, onRespond }) => {
  const { badgeVariant, cardBorder, animation } = getUrgencyStyles(request.urgency_level);
  const bloodTypeClass = getBloodTypeColor(request.blood_group);
  const timeAgo = formatDistanceToNow(new Date(request.created_at), { addSuffix: true });

  return (
    <Card className={`overflow-hidden ${cardBorder} ${animation}`}>
      <CardBody className="p-0">
        <div className="p-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center">
              <span className={`inline-flex items-center justify-center w-10 h-10 rounded-full font-bold text-lg ${bloodTypeClass}`}>
                {request.blood_group}
              </span>
              <div className="ml-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {request.units_needed} unit{request.units_needed > 1 ? 's' : ''} needed
                </h3>
                <p className="text-sm text-gray-500">
                  {request.contact_name}
                </p>
              </div>
            </div>
            <Badge variant={badgeVariant} className="ml-2">
              {request.urgency_level} Priority
            </Badge>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center text-sm text-gray-500">
              <MapPin className="h-4 w-4 mr-1 text-gray-400" />
              <span>{request.hospital_name}</span>
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <Clock className="h-4 w-4 mr-1 text-gray-400" />
              <span>Posted {timeAgo}</span>
            </div>
            {request.notes && (
              <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-2 rounded">
                "{request.notes}"
              </p>
            )}
          </div>

          <div className="mt-4 flex justify-between items-center">
            <Link 
              to={`/requests/${request.id}`}
              className="text-secondary-500 hover:text-secondary-600 text-sm font-medium"
            >
              View details
            </Link>
            {onRespond && (
              <Button 
                variant="primary" 
                size="sm"
                onClick={onRespond}
              >
                I can donate
              </Button>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
};