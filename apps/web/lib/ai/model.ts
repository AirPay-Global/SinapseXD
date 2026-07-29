/**
 * Central Anthropic model + error handling for every AI feature (advisors,
 * satellite advisor, corridor briefings, APRM narrative). Kept in one place so
 * the deployed model can be changed without editing five call sites, and so a
 * failure surfaces a real diagnosis instead of a generic "hit an error".
 *
 * The model is overridable via the ANTHROPIC_MODEL env var. The default is a
 * broadly-available GA model string; if an account has access to a newer or
 * specific dated model, set ANTHROPIC_MODEL in the environment group — no code
 * change or redeploy of this repo required.
 */
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

/** A concise, safe-to-show description of an Anthropic SDK error — enough to
 * tell a bad model from a bad key from an out-of-credit account, without
 * dumping internals. */
export function describeAnthropicError(err: unknown): string {
  const e = err as { status?: number; message?: string };
  const base = e?.message ? String(e.message).slice(0, 240) : "unknown error reaching Claude";
  if (e?.status === 404) return `model "${ANTHROPIC_MODEL}" isn't available for this Anthropic account — set ANTHROPIC_MODEL to a model your key can use.`;
  if (e?.status === 401 || e?.status === 403) return "Anthropic authentication failed — check ANTHROPIC_API_KEY.";
  if (e?.status === 429) return "Anthropic rate limit hit, or the account is out of credit.";
  return base;
}
