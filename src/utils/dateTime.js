const JOTFORM_LOCAL_DATETIME_REGEX = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;
const DD_MM_YYYY_HH_MM_REGEX = /^(\d{2})-(\d{2})-(\d{4})\s(\d{2}):(\d{2})$/;

export const parseJotformDate = (value) => {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number') {
        const ms = value < 1e12 ? value * 1000 : value;
        const date = new Date(ms);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const text = String(value).trim();

    // Try DD-MM-YYYY HH:MM format (from form timestamp field)
    const ddmmMatch = text.match(DD_MM_YYYY_HH_MM_REGEX);
    if (ddmmMatch) {
        const [, day, month, year, hour, minute] = ddmmMatch;
        return new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            0
        );
    }

    // Try YYYY-MM-DD HH:MM:SS format
    const localMatch = text.match(JOTFORM_LOCAL_DATETIME_REGEX);
    if (localMatch) {
        const [, year, month, day, hour, minute, second] = localMatch;
        return new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second)
        );
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getJotformTimestampMs = (value) => {
    const parsed = parseJotformDate(value);
    return parsed ? parsed.getTime() : 0;
};

export const formatJotformDate = (value) => {
    const parsed = parseJotformDate(value);
    return parsed ? parsed.toLocaleString() : 'Invalid date';
};
