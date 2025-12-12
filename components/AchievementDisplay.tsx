import React from 'react';
import { AchievementBadge } from './ui/Badge';
import { Card, CardBody, CardHeader } from './ui/Card';
import type { Achievement, Badge } from '../types';

interface AchievementDisplayProps {
  achievements: Achievement[];
  allBadges: Badge[];
}

export const AchievementDisplay: React.FC<AchievementDisplayProps> = ({ 
  achievements, 
  allBadges 
}) => {
  // Group badges by category for display
  const earnedBadgeIds = achievements.map(a => a.badge_id);
  
  // Organize badges in a grid
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-medium text-gray-900">Your Achievements</h3>
          <p className="text-sm text-gray-500">
            You've earned {achievements.length} out of {allBadges.length} badges
          </p>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {allBadges.map(badge => (
              <AchievementBadge
                key={badge.id}
                name={badge.name}
                imageUrl={badge.image_url}
                points={badge.points}
                unlocked={earnedBadgeIds.includes(badge.id)}
              />
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};