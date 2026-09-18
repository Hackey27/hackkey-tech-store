export const FULFILMENT_START_UTC_HOUR = 1;
export const FULFILMENT_END_UTC_HOUR = 16;

function timeParts(date: Date, timeZone?: string): { time: string; day: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return { time: `${value('hour')}:${value('minute')}`, day: `${value('year')}-${value('month')}-${value('day')}` };
}

export interface FulfilmentTimeState {
  insideWindow: boolean;
  localRange: string;
  nextStartLocalTime: string;
  currentLocalTime: string;
  crossesMidnight: boolean;
}

/** Pure UTC-window calculation; `timeZone` affects display only. */
export function fulfilmentTimeState(now: Date = new Date(), timeZone?: string): FulfilmentTimeState {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const insideWindow = utcMinutes >= FULFILMENT_START_UTC_HOUR * 60 && utcMinutes < FULFILMENT_END_UTC_HOUR * 60;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), FULFILMENT_START_UTC_HOUR));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), FULFILMENT_END_UTC_HOUR));
  const nextStart = new Date(start);
  if (utcMinutes >= FULFILMENT_START_UTC_HOUR * 60) nextStart.setUTCDate(nextStart.getUTCDate() + 1);
  const localStart = timeParts(start, timeZone);
  const localEnd = timeParts(end, timeZone);
  return {
    insideWindow,
    localRange: `${localStart.time}–${localEnd.time}`,
    nextStartLocalTime: timeParts(nextStart, timeZone).time,
    currentLocalTime: timeParts(now, timeZone).time,
    crossesMidnight: localStart.day !== localEnd.day
  };
}
