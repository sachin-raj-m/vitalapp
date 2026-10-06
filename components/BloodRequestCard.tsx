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

const URGENCY: Record<UrgencyLevel, { label: string; dot: string; text: string }> = {
  High: { label: 'Urgent', dot: 'bg-red-600', text: 'text-red-700' },
  Medium: { label: 'Soon', dot: 'bg-warning-500', text: 'text-warning-700' },
  Low: { label: 'Planned', dot: 'bg-gray-400', text: 'text-gray-600' },
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
        'group relative flex gap-4 rounded-lg border bg-white p-4 transition-colors sm:gap-5 sm:p-5',
        isUrgent ? 'border-red-200' : 'border-gray-200 hover:border-gray-300',
      )}
    >
      <div
        className={cn(
          'flex h-16 w-16 shrink-0 items-center justify-center rounded-md font-serif text-[2rem] leading-none tracking-tight sm:h-[4.5rem] sm:w-[4.5rem] sm:text-[2.25rem]',
          isUrgent ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-900',
        )}
        aria-label={`Blood group ${request.blood_group}`}
      >
        {formatBloodGroup(request.blood_group)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={cn('inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em]', urgency.text)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', urgency.dot)} />
            {urgency.label}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-gray-400">{timeAgo}</span>
        </div>

        <h3 className="mt-1.5 text-[17px] font-medium leading-snug tracking-tight text-gray-900">
          <Link href={`/requests/${request.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {units} at {request.hospital_name}
          </Link>
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          {[request.city, request.date_needed && `needed by ${format(parseISO(request.date_needed), 'd MMM')}`, `for ${request.contact_name}`]
            .filter(Boolean)
            .join(' · ')}
        </p>

        {request.notes && (
          <p className="mt-3 line-clamp-2 border-l-2 border-gray-200 pl-3 text-sm italic leading-relaxed text-gray-600">
            {request.notes}
          </p>
        )}

        {/* Actions sit above the stretched title link. */}
        <div className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-3">
          <ShareButton
            title={`${formatBloodGroup(request.blood_group)} blood needed: ${units} at ${request.hospital_name}`}
            text={`${request.hospital_name}${request.city ? `, ${request.city}` : ''} needs ${units} of ${formatBloodGroup(request.blood_group)}.`}
            path={`/requests/${request.id}`}
          />

          {isOwnRequest ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-gray-500">Your request</span>
          ) : onRespond && (
            hasOffered ? (
              <Button size="sm" variant="secondary" onClick={onPendingClick || onRespond} leftIcon={<Clock className="h-3.5 w-3.5" />}>
                You offered · view PIN
              </Button>
            ) : incompatible ? (
              <span className="text-[13px] text-gray-400">
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
