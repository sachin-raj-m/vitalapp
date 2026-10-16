"use client";

import React from 'react';
import { Select } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { INDIA_REGIONS, districtsOf, regionKey } from '@/lib/india-regions';

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

const STATES = INDIA_REGIONS.filter(r => r.type === 'state').map(r => r.name);
const UNION_TERRITORIES = INDIA_REGIONS.filter(r => r.type === 'ut').map(r => r.name);

/** The district to keep after choosing `state`: its only one, or `district` if it belongs to it. */
function districtFor(state: string, district: string): string {
    const districts = districtsOf(state);
    if (districts.length === 1) return districts[0];
    return districts.includes(district) ? district : '';
}

// Same look as <Select> in components/ui/Input.tsx, which only takes a flat
// option list; the state list needs <optgroup>s.
const selectClass = (error?: string) => cn(
    'w-full rounded-md border bg-white px-3 text-[15px] text-gray-900 transition-colors',
    'focus:outline-none focus:ring-0 disabled:bg-gray-100 disabled:text-gray-500',
    'h-10 appearance-none pr-9',
    error ? 'border-red-500 focus:border-red-600' : 'border-gray-300 hover:border-gray-400 focus:border-gray-900',
);

/**
 * State/UT, then District: the district list shows only the chosen state's
 * districts. Values are the canonical names from lib/india-regions.ts.
 * States and union territories are listed in separate groups. A UT with a
 * single district (Chandigarh, Lakshadweep) has it chosen automatically.
 */
export function StateDistrictSelect({
    state, district, onChange, previousState, previousDistrict,
    stateError, districtError, required, disabled,
}: StateDistrictSelectProps) {
    const stateId = React.useId();
    const districts = districtsOf(state);
    const districtOptions = [
        { value: '', label: state ? 'Choose your district' : 'Choose a state first' },
        ...districts.map(name => ({ value: name, label: name })),
    ];

    // Also when a saved profile has such a UT but no district.
    const onlyDistrict = districts.length === 1 ? districts[0] : '';
    React.useEffect(() => {
        if (onlyDistrict && district !== onlyDistrict) onChange({ state, district: onlyDistrict });
    }, [state, district, onlyDistrict, onChange]);

    const typed = (value: string | null | undefined) => (regionKey(value) ? value!.trim() : '');
    const stateHint = !state && typed(previousState)
        ? `Choose your state or union territory. You had entered “${typed(previousState)}”.`
        : undefined;
    const districtHint = state && !district
        ? typed(previousDistrict)
            ? `Choose your district. You had entered “${typed(previousDistrict)}”.`
            : 'Choose your district'
        : undefined;

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
                <label htmlFor={stateId} className="block text-[13px] font-medium text-gray-800">
                    State or union territory
                </label>
                <div className="relative">
                    <select
                        id={stateId}
                        value={state}
                        onChange={e => {
                            const next = e.target.value;
                            onChange({ state: next, district: districtFor(next, district) });
                        }}
                        required={required}
                        disabled={disabled}
                        autoComplete="address-level1"
                        aria-invalid={!!stateError || undefined}
                        aria-describedby={stateError ? `${stateId}-error` : stateHint ? `${stateId}-help` : undefined}
                        className={selectClass(stateError)}
                    >
                        <option value="">Choose your state or UT</option>
                        <optgroup label="States">
                            {STATES.map(name => <option key={name} value={name}>{name}</option>)}
                        </optgroup>
                        <optgroup label="Union territories">
                            {UNION_TERRITORIES.map(name => <option key={name} value={name}>{name}</option>)}
                        </optgroup>
                    </select>
                    <svg
                        aria-hidden
                        viewBox="0 0 16 16"
                        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
                    >
                        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
                {stateError && <p id={`${stateId}-error`} className="text-[13px] text-red-700">{stateError}</p>}
                {stateHint && !stateError && <p id={`${stateId}-help`} className="text-[13px] text-gray-500">{stateHint}</p>}
            </div>
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
