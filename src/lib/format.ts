const dFmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const dLong = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const mFmt = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
const mShort = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" });

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

export const fmtDate = (iso: string | null | undefined) => (iso ? dFmt.format(asDate(iso)) : "-");
export const fmtDateLong = (iso: string) => dLong.format(asDate(iso));
export const fmtMonth = (m: string) => mFmt.format(asDate(`${m}-01`));
export const fmtMonthShort = (m: string) => mShort.format(asDate(`${m}-01`));
