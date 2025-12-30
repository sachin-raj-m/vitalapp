"use client";


import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { fetchUserStats, type Achievement } from '@/lib/stats';
import { Award, Droplet, Heart, Lock, Calendar, Trophy, Star, Shield, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AchievementsPage() {
    const { user } = useAuth();
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    const [stats, setStats] = useState({
        total_donations: 0,
        total_requests: 0,
        total_points: 0,
    });

    useEffect(() => {
        if (user?.id) {
            loadData();
        }
    }, [user]);

    const loadData = async () => {
        if (!user?.id) return;

        try {
            const userStats = await fetchUserStats(user.id);

            setStats({
                total_donations: userStats.total_donations,
                total_requests: userStats.total_requests,
                total_points: userStats.total_points,
            });
            setAchievements(userStats.achievements);
        } catch (error) {
            console.error("Failed to load achievements", error);
        }
    };

    const getIconComponent = (iconType: string, unlocked: boolean) => {
        const className = unlocked ? "w-8 h-8 text-amber-600" : "w-8 h-8 text-slate-300";
        switch (iconType) {
            case 'droplet':
                return <Droplet className={className} />;
            case 'heart':
                return <Heart className="w-8 h-8 text-red-500" />;
            case 'shield':
                return <Shield className={className} />;
            case 'star':
                return <Star className={className} />;
            case 'trophy':
                return <Trophy className={className} />;
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
                        <div className="text-4xl font-black text-amber-600 mb-2">
                            {stats.total_points}
                        </div>
                        <div className="text-sm font-medium text-slate-500">Total Score</div>
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
                            key={achievement.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className={`border-2 ${achievement.unlocked ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200 bg-slate-50/50'} transition-all hover:shadow-lg h-full`}>
                                <CardBody className="p-6 flex flex-col h-full">
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className={`w-16 h-16 rounded-full flex items-center justify-center shrink-0 ${achievement.unlocked ? 'bg-amber-100' : 'bg-slate-200'} `}>
                                            {achievement.unlocked ? (
                                                getIconComponent(achievement.icon, true)
                                            ) : (
                                                <Lock className="w-8 h-8 text-slate-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-2">
                                                <h3 className={`font-bold text-lg leading-tight ${achievement.unlocked ? 'text-slate-900' : 'text-slate-500'} `}>
                                                    {achievement.name}
                                                </h3>
                                                <div className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full whitespace-nowrap">
                                                    {achievement.points} pts
                                                </div>
                                            </div>
                                            <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                                                {achievement.description}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-auto space-y-3">
                                        <p className="text-xs text-slate-500 italic border-l-2 border-amber-200 pl-3">
                                            "{achievement.motto}"
                                        </p>

                                        {achievement.unlocked && achievement.unlockedDate ? (
                                            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-100 px-3 py-1.5 rounded-full w-fit">
                                                <Calendar className="w-3 h-3" />
                                                <span className="font-medium">
                                                    Unlocked: {new Date(achievement.unlockedDate).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    })}
                                                </span>
                                            </div>
                                        ) : (
                                            <div>
                                                {achievement.threshold && (
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-xs text-slate-500">
                                                            <span>Progress</span>
                                                            <span>{achievement.progress} / {achievement.threshold}</span>
                                                        </div>
                                                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-amber-400 rounded-full transition-all duration-1000"
                                                                style={{ width: `${Math.min(100, (achievement.progress / achievement.threshold) * 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                {!achievement.threshold && (
                                                    <div className="text-xs text-slate-400 flex items-center gap-1">
                                                        <Lock className="w-3 h-3" />
                                                        Locked
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
