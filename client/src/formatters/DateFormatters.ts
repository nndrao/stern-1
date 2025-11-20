import { ValueFormatterParams } from 'ag-grid-community';

// Helper to pad numbers with leading zeros
const pad = (num: number, size: number = 2): string => {
  return String(num).padStart(size, '0');
};

// Month names for formatting
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Base date parser - handles various input formats
const parseDate = (value: any): Date | null => {
  if (!value) return null;

  // If already a Date object
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Try to parse as number (timestamp)
  if (typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  // Try to parse as string
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
};

// Date formatter factory
const createDateFormatter = (formatter: (date: Date) => string) => {
  return (params: ValueFormatterParams): string => {
    if (params.value == null) return '';

    const date = parseDate(params.value);
    if (!date) return '';

    try {
      return formatter(date);
    } catch {
      return '';
    }
  };
};

// ISO Formatters
export const formatterISODate = createDateFormatter(
  (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
);

export const formatterISODateTime = createDateFormatter(
  (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
);

export const formatterISODateTimeWithMillis = createDateFormatter(
  (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
);

// US Format Dates
export const formatterUSDate = createDateFormatter(
  (date) => `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()}`
);

export const formatterUSDateTime = createDateFormatter(
  (date) => `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
);

export const formatterUSDateTime12Hour = createDateFormatter(
  (date) => {
    const hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${pad(date.getMonth() + 1)}/${pad(date.getDate())}/${date.getFullYear()} ${pad(displayHours)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${ampm}`;
  }
);

// European Format Dates
export const formatterEUDate = createDateFormatter(
  (date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
);

export const formatterEUDateTime = createDateFormatter(
  (date) => `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
);

// Human Readable Formats
export const formatterLongDate = createDateFormatter(
  (date) => `${FULL_MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
);

export const formatterShortDate = createDateFormatter(
  (date) => `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
);

export const formatterLongDateTime = createDateFormatter(
  (date) => `${FULL_MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
);

export const formatterShortDateTime = createDateFormatter(
  (date) => `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
);

// Time Only Formats
export const formatterTime24Hour = createDateFormatter(
  (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
);

export const formatterTime12Hour = createDateFormatter(
  (date) => {
    const hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${pad(displayHours)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${ampm}`;
  }
);

export const formatterTimeShort = createDateFormatter(
  (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`
);

// Relative/Special Formats
export const formatterDateFromNow = createDateFormatter(
  (date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays === -1) return 'Tomorrow';
    if (diffDays > 0 && diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 0 && diffDays > -7) return `In ${Math.abs(diffDays)} days`;

    return formatterShortDate({ value: date } as ValueFormatterParams);
  }
);

// Unix Timestamp Formatters
export const formatterUnixTimestamp = createDateFormatter(
  (date) => String(Math.floor(date.getTime() / 1000))
);

export const formatterUnixTimestampMillis = createDateFormatter(
  (date) => String(date.getTime())
);

// Registry object for string-based access
export const dateFormatters = {
  // ISO Formats
  'ISODate': formatterISODate,
  'ISODateTime': formatterISODateTime,
  'ISODateTimeMillis': formatterISODateTimeWithMillis,

  // US Formats
  'USDate': formatterUSDate,
  'USDateTime': formatterUSDateTime,
  'USDateTime12Hour': formatterUSDateTime12Hour,

  // European Formats
  'EUDate': formatterEUDate,
  'EUDateTime': formatterEUDateTime,

  // Human Readable
  'LongDate': formatterLongDate,
  'ShortDate': formatterShortDate,
  'LongDateTime': formatterLongDateTime,
  'ShortDateTime': formatterShortDateTime,

  // Time Only
  'Time24Hour': formatterTime24Hour,
  'Time12Hour': formatterTime12Hour,
  'TimeShort': formatterTimeShort,

  // Special
  'DateFromNow': formatterDateFromNow,
  'UnixTimestamp': formatterUnixTimestamp,
  'UnixTimestampMillis': formatterUnixTimestampMillis,
};
