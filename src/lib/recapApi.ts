import Anthropic from '@anthropic-ai/sdk';
import type { AiRecap } from './types';
import { REFLECTION_FIELDS } from './types';
import { RECAP_MODEL, RECAP_SCHEMA, type RecapPrompt } from './recapPrompt';

/**
 * The one place entry text leaves the device: a single Messages API request,
 * made only when the person taps "Generate recap". The key is the person's own
 * and is sent only to api.anthropic.com.
 */
export async function requestAiRecap(apiKey: string, prompt: RecapPrompt): Promise<AiRecap> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: RECAP_MODEL,
      max_tokens: 16000,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
      output_config: { format: { type: 'json_schema', schema: RECAP_SCHEMA as unknown as Record<string, unknown> } },
    });
  } catch (e) {
    throw new Error(describeError(e));
  }

  if (message.stop_reason === 'refusal') {
    throw new Error('The recap could not be generated for this week. The local summary is still available.');
  }
  if (message.stop_reason === 'max_tokens') {
    throw new Error('The recap was cut off before it finished. Try again.');
  }
  const text = message.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
  return normalize(JSON.parse(text));
}

function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'The API key was not accepted. Check it in Settings.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'This API key is not allowed to use this model.';
  if (e instanceof Anthropic.RateLimitError) return 'Too many requests right now. Try again in a minute.';
  if (e instanceof Anthropic.BadRequestError) {
    const msg = e.message?.toLowerCase() ?? '';
    if (msg.includes('credit')) return 'The Anthropic account has no remaining credit.';
    return 'The request was not accepted. Try again later.';
  }
  if (e instanceof Anthropic.InternalServerError) return 'Anthropic is having trouble right now. Try again later.';
  if (e instanceof Anthropic.APIConnectionError) return "Couldn't reach Anthropic. Check the connection and try again.";
  if (e instanceof Anthropic.APIError) return 'The recap request failed. Try again later.';
  return 'Something went wrong while generating the recap.';
}

const list = (v: unknown, max: number): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()).slice(0, max) : [];

export function normalize(raw: unknown): AiRecap {
  const r = (raw ?? {}) as Record<string, unknown>;
  const t = (r.themes ?? {}) as Record<string, unknown>;
  const themes = Object.fromEntries(REFLECTION_FIELDS.map((f) => [f, list(t[f], 6)])) as AiRecap['themes'];
  return { themes, changes: list(r.changes, 6), questions: list(r.questions, 3) };
}
