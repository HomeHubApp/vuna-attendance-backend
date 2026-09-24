/**
 * @file The one place outbound email leaves the backend, via the Resend API:
 * a single send (`sendEmail`), a batch send (`sendEmailBatch`), and the
 * `escapeHtml` any template must use on text it didn't write itself.
 *
 * @remarks
 * Lives in `shared/` because more than one feature sends mail — the auth
 * emails (`auth/utils/sendEmail.js`: OTP codes, welcome, password reset) and
 * the lecturer's at-risk attendance warning
 * (`lecturer/course-details/atRiskNotificationService.js`). This file knows
 * nothing about any of those messages; it only delivers what it is given.
 *
 * "Accepted by Resend" is as far as this can see: a message that later
 * bounces, or lands in spam, is not reported here. It also depends on the
 * deployment's Resend setup — a sender domain that isn't verified can only
 * deliver to the account owner's own address, which shows up here as a
 * per-message failure, not a crash. There is no retry and no queue: a failed
 * message is reported to the caller and that is all. If volume grows past a
 * request's lifetime, the next step is a background job that drains a
 * table of pending emails.
 *
 * Configuration: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (both required at send
 * time, not at startup — a missing one fails the send with a clear message
 * instead of crashing the server) and optionally `RESEND_FROM_NAME`.
 */
import { Resend } from "resend";

const FROM_NAME = process.env.RESEND_FROM_NAME || "Veritas Attendance System";

/** Resend's cap on messages in one batch request. */
const BATCH_SIZE = 100;

let resendClient = null;

/** The Resend client, created on first use so a missing key fails at send time, not at startup. */
function getResend() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("Failed to send email: RESEND_API_KEY is not set");
  }
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

/** The "Name <address>" every message is sent from. */
function getFrom() {
  if (!process.env.RESEND_FROM_EMAIL) {
    throw new Error("Failed to send email: RESEND_FROM_EMAIL is not set");
  }
  return `${FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`;
}

/**
 * Escapes text for safe use inside an HTML email body. Use it on anything
 * that came from a user or the database (names, course titles) — a template
 * literal alone would let `<` or `&` in a name break, or inject into, the
 * message.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sends one email.
 *
 * The Resend SDK returns `{ data, error }` instead of throwing on API
 * errors, so a failure is converted into a thrown Error here.
 *
 * @param {{ to: string, subject: string, html: string }} message
 * @returns {Promise<object>} Resend's response data (the new email's id).
 * @throws {Error} When Resend isn't configured or rejects the message.
 */
export async function sendEmail({ to, subject, html }) {
  const from = getFrom();

  const { data, error } = await getResend().emails.send({ from, to, subject, html });

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`);
  }

  return data;
}

/**
 * Sends many different emails (one per recipient, each with its own subject
 * and body) using Resend's batch API — one request per 100 messages instead
 * of one per message, which keeps a class-sized send inside Resend's request
 * rate limit and quick enough to wait on.
 *
 * Never throws for a delivery problem: each message gets its own outcome,
 * so one bad address doesn't sink the rest (`permissive` validation), and a
 * request that fails outright (Resend down, not configured) marks just the
 * messages in it as failed.
 *
 * @param {Array<{ to: string, subject: string, html: string }>} messages
 * @param {{ batch: { send: Function } }} [resend] - The Resend client to use;
 *   defaults to the real one. Passed in only so the outcome mapping can be
 *   tested without sending anything.
 * @returns {Promise<Array<{ ok: true } | { ok: false, error: string }>>}
 *   One outcome per message, in the same order as `messages`.
 */
export async function sendEmailBatch(messages, resend) {
  const outcomes = [];

  for (let start = 0; start < messages.length; start += BATCH_SIZE) {
    const chunk = messages.slice(start, start + BATCH_SIZE);

    try {
      const from = getFrom();
      const { data, error } = await (resend ?? getResend()).batch.send(
        chunk.map(({ to, subject, html }) => ({ from, to, subject, html })),
        { batchValidation: "permissive" }
      );

      if (error) throw new Error(error.message);

      const rejected = new Map((data?.errors ?? []).map((item) => [item.index, item.message]));
      chunk.forEach((_, index) => {
        outcomes.push(rejected.has(index) ? { ok: false, error: rejected.get(index) } : { ok: true });
      });
    } catch (err) {
      chunk.forEach(() => outcomes.push({ ok: false, error: err.message || "Failed to send email" }));
    }
  }

  return outcomes;
}
