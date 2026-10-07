import React from 'react';
import Link from 'next/link';
import { formatDistanceToNow, format, parseISO } from 'date-fns';
import { Clock } from 'lucide-react';
import { Button } from './ui/Button';
import type { BloodRequest, BloodGroup, UrgencyLevel } from '../types';
import { formatBloodGroup, isBloodCompatible } from '@/lib/blood-compatibility';
import { ShareButton } from './ShareButton';
import { cn } from '@/lib/cn';

interface BloodRequestCardProps {
  request: BloodRequest;
  onRespond?: () => void;
  onPendingClick?: () => void;
  userBloodGroup?: BloodGroup | null;
  hasOffered?: boolean;
  isOwnRequest?: boolean;
}

const URGENCY: Record<UrgencyLevel, { label: string; className: string; dot: string }> = {
  High: { label: 'Urgent', className: 'bg-red-600 text-white', dot: 'bg-white' },
  Medium: { label: 'Needed soon', className: 'bg-warning-100 text-warning-800', dot: 'bg-warning-500' },
  Low: { label: 'Planned', className: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
};

export const BloodRequestCard: React.FC<BloodRequestCardProps> = ({
  request,
  onRespond,
  onPendingClick,
  userBloodGroup,
  hasOffered,
  isOwnRequest,
}) => {
  const urgency = URGENCY[request.urgency_level] ?? URGENCY.Low;
  const isUrgent = request.urgency_level === 'High';
  const timeAgo = formatDistanceToNow(new Date(request.created_at), { addSuffix: true });
  const incompatible = !!userBloodGroup && !isBloodCompatible(userBloodGroup, request.blood_group);
  const units = `${request.units_needed} unit${request.units_needed > 1 ? 's' : ''}`;

  return (
    <article
      className={cn(
        'lift group relative flex gap-4 overflow-hidden rounded-xl border bg-white p-4 sm:gap-5 sm:p-5',
        isUrgent ? 'border-red-200 hover:border-red-300' : 'border-gray-200 hover:border-gray-300',
      )}
    >
      <div
        className={cn(
          'flex h-16 w-16 shrink-0 items-center justify-center rounded-lg font-serif text-[2rem] font-semibold leading-none tracking-tight transition-transform duration-200 group-hover:scale-[1.04] sm:h-[4.5rem] sm:w-[4.5rem] sm:text-[2.25rem]',
          isUrgent ? 'bg-red-600 text-white shadow-md shadow-red-600/25' : 'bg-red-50 text-red-700',
        )}
        aria-label={`Blood group ${request.blood_group}`}
      >
        {formatBloodGroup(request.blood_group)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold', urgency.className)}>
            <span className="relative flex h-1.5 w-1.5" aria-hidden>
              {isUrgent && <span className={cn('absolute inline-flex h-full w-full rounded-full animate-beat', urgency.dot)} />}
              <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', urgency.dot)} />
            </span>
            {urgency.label}
          </span>
          <span className="text-xs text-gray-500">Posted {timeAgo}</span>
        </div>

        <h3 className="mt-1.5 text-[17px] font-semibold leading-snug tracking-tight text-gray-900">
          <Link href={`/requests/${request.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {units} at {request.hospital_name}
          </Link>
        </h3>

        <p className="mt-1 text-sm text-gray-600">
          {[request.city, request.date_needed && `Needed by ${format(parseISO(request.date_needed), 'd MMM')}`, `Contact: ${request.contact_name}`]
            .filter(Boolean)
            .join(' · ')}
        </p>

        {request.notes && (
          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-600">
            {request.notes}
          </p>
        )}

        {/* Actions sit above the stretched title link. */}
        <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3">
          <ShareButton request={request} />

          {isOwnRequest ? (
            <span className="text-sm text-gray-500">Your request</span>
          ) : onRespond && (
            hasOffered ? (
              <Button size="sm" variant="secondary" onClick={onPendingClick || onRespond} leftIcon={<Clock className="h-3.5 w-3.5" />}>
                Offer sent · View PIN
              </Button>
            ) : incompatible ? (
              <span className="text-[13px] text-gray-500">
                Not compatible with {formatBloodGroup(userBloodGroup)}
              </span>
            ) : (
              <Button size="sm" variant={isUrgent ? 'primary' : 'ink'} onClick={onRespond}>
                I can donate
              </Button>
            )
          )}
        </div>
      </div>
    </article>
  );
};
