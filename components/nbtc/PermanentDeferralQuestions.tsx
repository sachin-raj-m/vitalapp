"use client";

import React from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface PermanentDeferralQuestionsProps {
    onStatusChange: (isEligible: boolean) => void;
}

export function PermanentDeferralQuestions({ onStatusChange }: PermanentDeferralQuestionsProps) {
    const [answers, setAnswers] = React.useState<Record<string, boolean>>({});

    const questions = [
        { id: 'q1', text: "Have you ever tested positive for HIV, Hepatitis B, or Hepatitis C?" },
        { id: 'q2', text: "Do you have a history of Heart Disease, Kidney Failure, or Cancer?" },
        { id: 'q3', text: "Are you currently on Insulin for Diabetes?" },
        { id: 'q4', text: "Do you have Epilepsy or a history of fits?" },
        { id: 'q5', text: "(For Women) Are you currently pregnant or breastfeeding?" },
    ];

    const handleAnswer = (id: string, value: boolean) => {
        const newAnswers = { ...answers, [id]: value };
        setAnswers(newAnswers);

        // Check if all questions are answered
        if (Object.keys(newAnswers).length === questions.length) {
            // If ANY answer is YES (true), they are NOT eligible
            const hasDisqualifyingCondition = Object.values(newAnswers).some(val => val === true);
            onStatusChange(!hasDisqualifyingCondition);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 p-4 bg-blue-50 text-blue-800 rounded-lg">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-sm">
                    <strong>NBTC Safety Check:</strong> Please answer these questions truthfully.
                    This ensures the safety of both you and the recipient.
                </p>
            </div>

            <div className="space-y-4">
                {questions.map((q) => (
                    <Card key={q.id} className={`p-4 border transition-colors ${answers[q.id] === true ? 'border-red-200 bg-red-50' :
                            answers[q.id] === false ? 'border-green-200 bg-green-50' : 'border-gray-200'
                        }`}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <p className="text-slate-700 font-medium">{q.text}</p>
                            <div className="flex gap-4 shrink-0">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name={q.id}
                                        checked={answers[q.id] === true}
                                        onChange={() => handleAnswer(q.id, true)}
                                        className="w-4 h-4 text-red-600 focus:ring-red-500"
                                    />
                                    <span className="text-sm font-semibold text-slate-600">Yes</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name={q.id}
                                        checked={answers[q.id] === false}
                                        onChange={() => handleAnswer(q.id, false)}
                                        className="w-4 h-4 text-green-600 focus:ring-green-500"
                                    />
                                    <span className="text-sm font-semibold text-slate-600">No</span>
                                </label>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
