const ALLOWED_EMAILS = [
  "johnnyoutlawllc@gmail.com",
  "bigsky30media@gmail.com",
];

export function isAllowedEmail(email?: string | null) {
  return !!email && ALLOWED_EMAILS.includes(email.toLowerCase());
}
