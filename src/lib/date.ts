const defaultTimeZone = "Asia/Seoul";

export function getLocalDateKey(date = new Date(), timeZone = defaultTimeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function getYesterdayLocalDateKey(date = new Date(), timeZone = defaultTimeZone) {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return getLocalDateKey(previous, timeZone);
}

export function sameLocalDate(value: string, date = new Date(), timeZone = defaultTimeZone) {
  return getLocalDateKey(new Date(value), timeZone) === getLocalDateKey(date, timeZone);
}
