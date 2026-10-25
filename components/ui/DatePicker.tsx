"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    addDays,
    addMonths,
    addYears,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    format,
    isSameMonth,
    isValid,
    startOfMonth,
    startOfWeek,
} from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/cn';

/*
 * A date field with a calendar of its own, in place of the browser's
 * <input type="date">. Values stay 'yyyy-MM-dd' strings ('' = no date), so
 * forms and the database see exactly what they saw before.
 *
 * Desktop: a popover under the field. Phones: a bottom sheet. Both are
 * dialogs that trap Tab, close on Escape and hand focus back to the field.
 * The month is an ARIA grid: arrows move by day/week, Home/End to the week's
 * ends, PageUp/PageDown by month (with Shift, by year). Days outside min/max
 * are faded, struck through and can't be focused or chosen.
 */

const LOCALE = 'en-IN';
const WEEK_STARTS_ON = 1; // Monday, as calendars in India do.

/** Today's date in India (yyyy-MM-dd), whatever the device's time zone. */
export const todayInIndia = () => {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    return `${part('year')}-${part('month')}-${part('day')}`;
};

/** 'yyyy-MM-dd' to a local-midnight Date, or null if it isn't a real date. */
const parseYmd = (ymd: string | undefined | null): Date | null => {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
    const [y, m, d] = ymd.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return isValid(date) && date.getMonth() === m - 1 ? date : null;
};
const toYmd = (date: Date) => format(date, 'yyyy-MM-dd');

/** Shift a 'yyyy-MM-dd' date by whole days. */
export const addDaysYmd = (ymd: string, days: number) => {
    const date = parseYmd(ymd);
    return date ? toYmd(addDays(date, days)) : ymd;
};

const fmtDayLabel = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonthTitle = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' });
const fmtWeekdayShort = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const fmtWeekdayLong = new Intl.DateTimeFormat(LOCALE, { weekday: 'long' });
const fmtMonthShort = new Intl.DateTimeFormat(LOCALE, { month: 'short' });

/** Monday-first weekday names (5 Jan 2026 is a Monday). */
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2026, 0, 5 + i);
    return { short: fmtWeekdayShort.format(d), long: fmtWeekdayLong.format(d) };
});

/** "Today, Mon 26 Oct" · "Tomorrow, Tue 27 Oct" · "Thu 29 Oct" · "Sat 14 Jun 2025". */
export const describeDate = (ymd: string, today: string = todayInIndia()) => {
    const date = parseYmd(ymd);
    const now = parseYmd(today);
    if (!date || !now) return '';
    const base = `${fmtWeekdayShort.format(date)} ${date.getDate()} ${fmtMonthShort.format(date)}`;
    const withYear = date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`;
    if (ymd === today) return `Today, ${withYear}`;
    if (ymd === addDaysYmd(today, 1)) return `Tomorrow, ${withYear}`;
    if (ymd === addDaysYmd(today, -1)) return `Yesterday, ${withYear}`;
    return withYear;
};

const clampYmd = (ymd: string, min?: string, max?: string) =>
    min && ymd < min ? min : max && ymd > max ? max : ymd;

const useIsDesktop = () => {
    const [desktop, setDesktop] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 640px)');
        const update = () => setDesktop(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);
    return desktop;
};

export interface DatePreset {
    label: string;
    /** 'yyyy-MM-dd'. */
    value: string;
}

export interface DatePickerProps {
    /** 'yyyy-MM-dd', or '' for no date. */
    value: string;
    onChange: (value: string) => void;
    label?: string;
    helperText?: string;
    error?: string;
    /** Earliest day that can be chosen ('yyyy-MM-dd'). */
    min?: string;
    /** Latest day that can be chosen ('yyyy-MM-dd'). */
    max?: string;
    /** Quick picks shown above the calendar, e.g. Today, Tomorrow. */
    presets?: DatePreset[];
    /** Shown on the field when there's no date. */
    placeholder?: string;
    /** Offer a way back to no date. */
    clearable?: boolean;
    /** Defaults to today in India; only for highlighting and the words on the field. */
    today?: string;
    id?: string;
    /** Marks the field as wrong without a message (the message lives elsewhere). */
    invalid?: boolean;
    /** Extra ids describing the field, e.g. a note under it. */
    describedBy?: string;
    onBlur?: () => void;
    className?: string;
}

export const DatePicker = ({
    value,
    onChange,
    label,
    helperText,
    error,
    min,
    max,
    presets,
    placeholder = 'Choose a date',
    clearable = false,
    today: todayProp,
    id: idProp,
    invalid,
    describedBy,
    onBlur,
    className,
}: DatePickerProps) => {
    const generatedId = useId();
    const id = idProp || `date-${generatedId.replace(/:/g, '')}`;
    const labelId = `${id}-label`;
    const valueId = `${id}-value`;
    const titleId = `${id}-title`;
    const desktop = useIsDesktop();
    const today = todayProp ?? todayInIndia();

    const [open, setOpen] = useState(false);
    // The day with keyboard focus in the grid; the month shown follows it.
    const [focused, setFocused] = useState(() => clampYmd(parseYmd(value) ? value : today, min, max));
    const [placeRight, setPlaceRight] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLTableElement>(null);
    // Move DOM focus to the focused day only when the keyboard (or opening) moved it.
    const focusGrid = useRef(false);

    const close = useCallback((returnFocus = true) => {
        setOpen(false);
        if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
    }, []);

    const openPicker = () => {
        setFocused(clampYmd(parseYmd(value) ? value : today, min, max));
        const rect = triggerRef.current?.getBoundingClientRect();
        // A narrow field lines the popover up with its right edge, unless that runs off the left.
        setPlaceRight(!!rect && rect.left + 368 > Math.min(rect.right, window.innerWidth - 16) && rect.right - 368 >= 16);
        focusGrid.current = true;
        setOpen(true);
    };

    const choose = (ymd: string) => {
        if ((min && ymd < min) || (max && ymd > max)) return;
        onChange(ymd);
        close();
    };

    // Focus the day cell after opening or keyboard moves.
    useEffect(() => {
        if (!open || !focusGrid.current) return;
        focusGrid.current = false;
        gridRef.current?.querySelector<HTMLElement>(`[data-date="${focused}"]`)?.focus();
    }, [open, focused, desktop]);

    // Tab stays inside, Escape closes; outside clicks close the popover.
    // The sheet also locks page scroll.
    useEffect(() => {
        if (!open) return;
        const dialog = dialogRef.current;
        const focusables = () =>
            Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]') ?? [])
                .filter(el => el.offsetParent !== null);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                close();
                return;
            }
            if (e.key !== 'Tab') return;
            const items = focusables();
            if (!items.length) return;
            const [head, tail] = [items[0], items[items.length - 1]];
            if (!dialog?.contains(document.activeElement)) {
                e.preventDefault();
                head.focus();
            } else if (e.shiftKey && document.activeElement === head) {
                e.preventDefault();
                tail.focus();
            } else if (!e.shiftKey && document.activeElement === tail) {
                e.preventDefault();
                head.focus();
            }
        };
        const onPointer = (e: PointerEvent) => {
            const target = e.target as Node;
            if (dialog?.contains(target) || triggerRef.current?.contains(target)) return;
            close(false);
        };
        document.addEventListener('keydown', onKey, true);
        if (desktop) document.addEventListener('pointerdown', onPointer);
        const prevOverflow = document.body.style.overflow;
        if (!desktop) document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey, true);
            document.removeEventListener('pointerdown', onPointer);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, desktop, close]);

    const focusedDate = parseYmd(focused) ?? new Date();
    const monthKey = toYmd(startOfMonth(focusedDate));
    const monthStart = parseYmd(monthKey)!;
    const first = monthStart;
    const days = eachDayOfInterval({
        start: startOfWeek(first, { weekStartsOn: WEEK_STARTS_ON }),
        end: endOfWeek(endOfMonth(first), { weekStartsOn: WEEK_STARTS_ON }),
    });
    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

    const minMonth = min ? min.slice(0, 7) : null;
    const maxMonth = max ? max.slice(0, 7) : null;
    const shownMonth = monthKey.slice(0, 7);
    const canPrev = !minMonth || shownMonth > minMonth;
    const canNext = !maxMonth || shownMonth < maxMonth;

    const moveTo = (next: Date, viaKeyboard: boolean) => {
        focusGrid.current = viaKeyboard;
        setFocused(clampYmd(toYmd(next), min, max));
    };

    const onGridKey = (e: React.KeyboardEvent) => {
        const d = focusedDate;
        let next: Date | null = null;
        switch (e.key) {
            case 'ArrowLeft': next = addDays(d, -1); break;
            case 'ArrowRight': next = addDays(d, 1); break;
            case 'ArrowUp': next = addDays(d, -7); break;
            case 'ArrowDown': next = addDays(d, 7); break;
            case 'Home': next = startOfWeek(d, { weekStartsOn: WEEK_STARTS_ON }); break;
            case 'End': next = endOfWeek(d, { weekStartsOn: WEEK_STARTS_ON }); break;
            case 'PageUp': next = e.shiftKey ? addYears(d, -1) : addMonths(d, -1); break;
            case 'PageDown': next = e.shiftKey ? addYears(d, 1) : addMonths(d, 1); break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                choose(focused);
                return;
            default:
                return;
        }
        e.preventDefault();
        moveTo(next, true);
    };

    const selected = parseYmd(value) ? value : '';
    const words = selected ? describeDate(selected, today) : '';
    const presetMatch = presets?.some(p => p.value === selected);
    const describedByIds = [error ? `${id}-error` : helperText ? `${id}-help` : null, describedBy].filter(Boolean).join(' ') || undefined;
    const isInvalid = !!error || !!invalid;

    const calendar = (
        <div className="select-none">
            {presets && presets.length > 0 && (
                <div className="mb-4 flex gap-1.5" role="group" aria-label="Quick picks">
                    {presets.map(p => {
                        const off = (min && p.value < min) || (max && p.value > max);
                        const on = p.value === selected;
                        return (
                            <button
                                key={p.label}
                                type="button"
                                disabled={!!off}
                                aria-pressed={on}
                                onClick={() => choose(p.value)}
                                className={cn(
                                    'h-10 min-w-0 flex-1 whitespace-nowrap rounded-full border px-1 text-[13px] font-medium transition-colors',
                                    on ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-800 hover:border-gray-900',
                                    'disabled:cursor-not-allowed disabled:opacity-40',
                                )}
                            >
                                {p.label}
                            </button>
                        );
                    })}
                    <button
                        type="button"
                        aria-pressed={!!selected && !presetMatch}
                        onClick={() => gridRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus()}
                        className={cn(
                            'h-10 min-w-0 flex-1 whitespace-nowrap rounded-full border px-1 text-[13px] font-medium transition-colors',
                            selected && !presetMatch ? 'border-gray-900 bg-gray-900 text-white' : 'border-dashed border-gray-300 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900',
                        )}
                    >
                        Pick a date
                    </button>
                </div>
            )}

            <div className="mb-2 flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => moveTo(addMonths(focusedDate, -1), false)}
                    disabled={!canPrev}
                    aria-label="Previous month"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-25"
                >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <p className="font-serif text-[1.375rem] leading-none tracking-[-0.01em] text-gray-900" id={`${id}-month`} aria-live="polite">
                    {fmtMonthTitle.format(monthStart)}
                </p>
                <button
                    type="button"
                    onClick={() => moveTo(addMonths(focusedDate, 1), false)}
                    disabled={!canNext}
                    aria-label="Next month"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 disabled:pointer-events-none disabled:opacity-25"
                >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
            </div>

            <table ref={gridRef} role="grid" aria-labelledby={`${id}-month`} className="w-full table-fixed border-collapse" onKeyDown={onGridKey}>
                <thead>
                    <tr>
                        {WEEKDAYS.map(w => (
                            <th key={w.long} scope="col" abbr={w.long} className="pb-1.5 text-center text-[11px] font-medium uppercase tracking-[0.08em] text-gray-400">
                                {w.short}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {weeks.map(week => (
                        <tr key={toYmd(week[0])}>
                            {week.map(day => {
                                const ymd = toYmd(day);
                                if (!isSameMonth(day, monthStart)) return <td key={ymd} className="p-0.5" />;
                                const disabled = (!!min && ymd < min) || (!!max && ymd > max);
                                const isSelected = ymd === selected;
                                const isToday = ymd === today;
                                const isFocused = ymd === focused;
                                return (
                                    <td
                                        key={ymd}
                                        role="gridcell"
                                        data-date={ymd}
                                        tabIndex={!disabled && isFocused ? 0 : -1}
                                        aria-selected={isSelected}
                                        aria-disabled={disabled || undefined}
                                        aria-current={isToday ? 'date' : undefined}
                                        aria-label={`${fmtDayLabel.format(day)}${isToday ? ', today' : ''}${disabled ? ', not available' : ''}`}
                                        onClick={() => { if (!disabled) choose(ymd); }}
                                        onFocus={() => { if (!disabled && !isFocused) setFocused(ymd); }}
                                        className={cn('group p-0.5 outline-none focus-visible:ring-0 focus-visible:ring-offset-0', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
                                    >
                                        <span
                                            aria-hidden
                                            className={cn(
                                                'mx-auto flex h-11 w-full max-w-11 items-center justify-center rounded-full text-[15px] tabular-nums transition-colors sm:h-10 sm:max-w-10',
                                                'group-focus-visible:ring-2 group-focus-visible:ring-gray-900 group-focus-visible:ring-offset-2',
                                                disabled
                                                    ? 'text-gray-300 line-through decoration-gray-300 opacity-70'
                                                    : isSelected
                                                        ? 'bg-gray-900 font-semibold text-white'
                                                        : 'text-gray-900 group-hover:bg-gray-100',
                                                isToday && !isSelected && !disabled && 'font-semibold text-red-700 ring-1 ring-inset ring-red-600',
                                                isToday && isSelected && 'ring-2 ring-red-600 ring-offset-2',
                                            )}
                                        >
                                            {day.getDate()}
                                        </span>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>

            {clearable && selected && (
                <div className="mt-3 flex justify-end border-t border-gray-200 pt-3">
                    <button
                        type="button"
                        onClick={() => { onChange(''); close(); }}
                        className="h-10 rounded-md px-3 text-[13px] font-medium text-gray-600 underline decoration-gray-300 underline-offset-4 hover:text-gray-900"
                    >
                        Clear date
                    </button>
                </div>
            )}
        </div>
    );

    const dialogTitle = label ?? 'Choose a date';

    return (
        <div className={cn('space-y-1.5', className)}>
            {label && (
                <label id={labelId} htmlFor={id} className="block text-[13px] font-medium text-gray-800">
                    {label}
                </label>
            )}
            <div className="relative">
                <button
                    ref={triggerRef}
                    id={id}
                    type="button"
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    aria-labelledby={label ? `${labelId} ${valueId}` : valueId}
                    aria-describedby={describedByIds}
                    onClick={() => (open ? close() : openPicker())}
                    onBlur={onBlur}
                    className={cn(
                        'flex h-10 w-full items-center gap-2 rounded-md border bg-white px-3 text-left text-[15px] transition-colors focus:outline-none',
                        isInvalid ? 'border-red-500 focus:border-red-600' : 'border-gray-300 hover:border-gray-400 focus:border-gray-900',
                        open && !isInvalid && 'border-gray-900',
                    )}
                >
                    <CalendarDays className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
                    <span id={valueId} suppressHydrationWarning className={cn('min-w-0 flex-1 truncate', words ? 'text-gray-900' : 'text-gray-400')}>
                        {words || placeholder}
                    </span>
                </button>

                {open && desktop && (
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        className={cn(
                            'absolute top-full z-40 mt-2 w-[23rem] rounded-xl border border-gray-200 bg-white p-4 shadow-[0_12px_40px_-12px_rgba(17,24,39,0.25)]',
                            'motion-safe:animate-[fade-up_0.18s_cubic-bezier(0.2,0.7,0.2,1)_both]',
                            placeRight ? 'right-0' : 'left-0',
                        )}
                    >
                        <h2 id={titleId} className="sr-only">{dialogTitle}</h2>
                        {calendar}
                    </div>
                )}
            </div>
            {error && <p id={`${id}-error`} className="text-[13px] text-red-700">{error}</p>}
            {helperText && !error && <p id={`${id}-help`} className="text-[13px] text-gray-500">{helperText}</p>}

            {open && !desktop && createPortal(
                <div className="fixed inset-0 z-[60] flex items-end justify-center">
                    <div className="absolute inset-0 bg-gray-950/40 backdrop-blur-[2px]" onClick={() => close()} aria-hidden />
                    <div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-gray-200 bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 motion-safe:animate-[fade-up_0.25s_cubic-bezier(0.2,0.7,0.2,1)_both]"
                    >
                        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" aria-hidden />
                        <div className="mb-4 flex items-center justify-between gap-4">
                            <h2 id={titleId} className="text-[15px] font-semibold tracking-[-0.01em] text-gray-900">{dialogTitle}</h2>
                            <button
                                type="button"
                                onClick={() => close()}
                                aria-label="Close"
                                className="-mr-1.5 flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                            >
                                <X className="h-4 w-4" aria-hidden />
                            </button>
                        </div>
                        {calendar}
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
};
