// The model has no clock. Without this it guesses "today" for transactions
// from yesterday and cannot say dates naturally.
export function describeCallDate(
  call_started_at: Date,
  time_zone: string,
): string {
  const date_text = new Intl.DateTimeFormat('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: time_zone,
  }).format(call_started_at);
  const time_text = new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: time_zone,
  }).format(call_started_at);
  return `Today is ${date_text}, and the call started at ${time_text} (${time_zone} time). Use this to describe dates relative to today, such as "yesterday evening".`;
}
