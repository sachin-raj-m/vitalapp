"use client";

import React from 'react';
import { Select } from '@/components/ui/Input';
import { STATE_NAMES, districtsOf, regionKey } from '@/lib/india-regions';

export interface Region {
    state: string;
    district: string;
}

interface StateDistrictSelectProps {
    /** A listed state or UT name, or ''. */
    state: string;
    /** A listed district of `state`, or ''. */
    district: string;
    onChange: (next: Region) => void;
    /**
     * What the profile had saved before, when it couldn't be matched to the
     * list (resolveRegion() gave ''). Shown in the hint so the person knows
     * what to pick.
     */
    previousState?: string | null;
    previousDistrict?: string | null;
    stateError?: string;
    districtError?: string;
    required?: boolean;
    disabled?: boolean;
}

const stateOptions = [
    { value: '', label: 'Choose your state' },
    ...STATE_NAMES.map(name => ({ value: name, label: name })),
];

/**
 * State/UT, then District: the district list shows only the chosen state's
 * districts. Values are the canonical names from lib/india-regions.ts.
 */
export function StateDistrictSelect({
    state, district, onChange, previousState, previousDistrict,
    stateError, districtError, required, disabled,
}: StateDistrictSelectProps) {
    const districts = districtsOf(state);
    const districtOptions = [
        { value: '', label: state ? 'Choose your district' : 'Choose a state first' },
        ...districts.map(name => ({ value: name, label: name })),
    ];

    const typed = (value: string | null | undefined) => (regionKey(value) ? value!.trim() : '');
    const stateHint = !state && typed(previousState)
        ? `Choose your state. You had entered “${typed(previousState)}”.`
        : undefined;
    const districtHint = state && !district
        ? typed(previousDistrict)
            ? `Choose your district. You had entered “${typed(previousDistrict)}”.`
            : 'Choose your district'
        : undefined;

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <Select
                label="State or union territory"
                value={state}
                onChange={e => {
                    const next = e.target.value;
                    // Keep the district only if it belongs to the new state.
                    onChange({ state: next, district: districtsOf(next).includes(district) ? district : '' });
                }}
                options={stateOptions}
                required={required}
                disabled={disabled}
                autoComplete="address-level1"
                error={stateError}
                helperText={stateHint}
            />
            <Select
                label="District"
                value={districts.includes(district) ? district : ''}
                onChange={e => onChange({ state, district: e.target.value })}
                options={districtOptions}
                required={required}
                disabled={disabled || !state}
                error={districtError}
                helperText={districtHint}
            />
        </div>
    );
}
