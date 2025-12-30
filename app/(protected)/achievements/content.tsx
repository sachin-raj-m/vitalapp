"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { fetchUserStats, fetchDetailedAchievements, type AchievementData } from '@/lib/stats';
import { Award, Droplet, Heart, Lock, Calendar, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AchievementsPage() {
    const { user } = useAuth();
    const [achievements, setAchievements] = useState<AchievementData[]>([]);
    const [stats, setStats] = useState({
        total_donations: 0,
        total_requests: 0,
    });

    useEffect(() => {
        if (user?.id) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        if (!user?.id) return;

        const [userStats, detailedAchievements] = await Promise.all([
            fetchUserStats(user.id),
            fetchDetailedAchievements(user.id)
        ]);

        setStats({
            total_donations: userStats.total_donations,
            total_requests: userStats.total_requests,
        });
        setAchievements(detailedAchievements);
    };

    const getIconComponent = (iconType: string, unlocked: boolean) => {
        const className = unlocked ? "w-8 h-8 text-amber-600" : "w-8 h-8 text-slate-300";
        switch (iconType) {
            case 'droplet':
                return <Droplet className={className} />;
            case 'heart':
                return <Heart className={className} />;
            default:
                return <Award className={className} />;
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-8 space-y-8">
            <div className="flex items-center gap-3">
                <Trophy className="w-8 h-8 text-amber-500" />
                <h1 className="text-3xl font-bold text-slate-900">Your Achievements</h1>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <Card className="border-slate-200">
                    <CardBody className="p-6 text-center">
                        <div className="text-4xl font-black text-amber-600 mb-2">
                            {achievements.filter(a => a.unlocked).length}
                        </div>
                        <div className="text-sm font-medium text-slate-500">Badges Earned</div>
                    </CardBody>
                </Card>

                <Card className="border-slate-200">
                    <CardBody className="p-6 text-center">
                        <div className="text-4xl font-black text-red-600 mb-2">
                            {stats.total_donations}
                        </div>
                        <div className="text-sm font-medium text-slate-500">Total Donations</div>
                    </CardBody>
                </Card>

                <Card className="border-slate-200">
                    <CardBody className="p-6 text-center">
                        <div className="text-4xl font-black text-blue-600 mb-2">
                            {stats.total_requests}
                        </div>
                        <div className="text-sm font-medium text-slate-500">Requests Posted</div>
                    </CardBody>
                </Card>

                <Card className="border-slate-200">
                    <CardBody className="p-6 text-center">
                        <div className="text-4xl font-black text-slate-900 mb-2">
                            {achievements.filter(a => a.unlocked).length}/{achievements.length}
                        </div>
                        <div className="text-sm font-medium text-slate-500">Progress</div>
                    </CardBody>
                </Card>
            </div>

            {/* Achievements Grid */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Hall of Fame</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {achievements.map((achievement, index) => (
                        <motion.div
                            key={achievement.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className={`border - 2 ${achievement.unlocked ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200 opacity-60'} transition - all hover: shadow - lg`}>
                                <CardBody className="p-6">
                                    <div className="flex items-start gap-4">
                                        <div className={`w - 16 h - 16 rounded - full flex items - center justify - center ${achievement.unlocked ? 'bg-amber-100' : 'bg-slate-100'} `}>
                                            {achievement.unlocked ? (
                                                getIconComponent(achievement.icon, true)
                                            ) : (
                                                <Lock className="w-8 h-8 text-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className={`font - bold text - lg mb - 1 ${achievement.unlocked ? 'text-slate-900' : 'text-slate-400'} `}>
                                                {achievement.name}
                                            </h3>
                                            <p className="text-sm text-slate-600 mb-3">
                                                {achievement.description}
                                            </p>
                                            {achievement.unlocked && achievement.unlockedDate && (
                                                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full w-fit">
                                                    <Calendar className="w-3 h-3" />
                                                    <span className="font-medium">
                                                        Unlocked: {new Date(achievement.unlockedDate).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                            )}
                                            {!achievement.unlocked && (
                                                <div className="text-xs text-slate-400 italic">
                                                    🔒 Locked
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}
