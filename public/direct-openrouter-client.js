/**
 * Browser-side OpenRouter streaming helper (callback-based).
 *
 * This client streams responses directly from OpenRouter in the browser so that
 * the user's API key and prompts never touch your server.
 *
 * Exports:
 *   - browserStreamChatCompletion(params, handlers?): { cancel(): void, promise: Promise<void> }
 *   - browserChatCompletionAggregated(params): Promise<string>
 *   - stripTripleBacktickCodeFence(text): string
 *
 * Example usage (streaming):
 *   import { browserStreamChatCompletion } from "/direct-openrouter-client.js";
 *
 *   const ctl = browserStreamChatCompletion({
 *     messages,
 *     apiKey,
 *     model: "moonshotai/kimi-k2-0905",
 *     temperature: 0.7,
 *   }, {
 *     onDelta: (chunk) => { /* append to UI *\/ },
 *     onDone: () => { /* finalize UI *\/ },
 *     onError: (err) => { console.error(err); },
 *   });
 *
 *   // To cancel:
 *   ctl.cancel();
 *   await ctl.promise.catch(() => {}); // optional wait for cleanup
 *
 * Example usage (aggregate):
 *   import { browserChatCompletionAggregated } from "/direct-openrouter-client.js";
 *   const html = await browserChatCompletionAggregated({ messages, apiKey });
 *
 * Security notes:
 * - The API keys are stored on localStorage.
 * - Render untrusted HTML in a sandboxed iframe with a strict CSP to prevent exfiltration.
 */

/**
 * @typedef {"system"|"user"|"assistant"} ChatRole
 * @typedef {{ role: ChatRole, content: string }} ChatMessage
 */

/**
 * @typedef {Object} StreamParams
 * @property {ChatMessage[]} messages - Chat messages to send.
 * @property {string} apiKey - OpenRouter API key (Bearer).
 * @property {string=} model - Model to use (default: window.OPENROUTER_MODEL || "moonshotai/kimi-k2-0905").
 * @property {number=} temperature - Sampling temperature (e.g. 0.7).
 * @property {number=} top_p - Nucleus sampling (optional).
 * @property {number=} max_tokens - Max tokens (optional).
 * @property {string|string[]=} stop - Stop sequences (optional).
 * @property {AbortSignal=} signal - Optional external AbortSignal to cancel.
 * @property {string=} baseUrl - Override the API base (default: window.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1").
 * @property {string=} siteUrl - Override HTTP-Referer header (default: window.OPENROUTER_SITE_URL).
 * @property {string=} appName - Override X-Title header (default: window.OPENROUTER_APP_NAME).
 * @property {Record<string, any>=} extra - Extra fields to include in request body.
 */

/**
 * @typedef {Object} StreamHandlers
 * @property {(delta: string) => void=} onDelta - Called with each streamed content delta.
 * @property {() => void=} onDone - Called once when stream completes ([DONE]).
 * @property {(err: any) => void=} onError - Called on error.
 */

/**
 * Start a browser-side streaming chat completion to OpenRouter using callbacks.
 * No async generators or for-await-of loops are used; compatible with a wide range of browsers.
 *
 * @param {StreamParams} params
 * @param {StreamHandlers=} handlers
 * @returns {{ cancel(): void, promise: Promise<void> }}
 */
export function browserStreamChatCompletion(params, handlers = {}) {
  const {
    messages,
    apiKey,
    model = (typeof window !== "undefined" &&
      (window.OPENROUTER_MODEL || "moonshotai/kimi-k2-0905")) ||
      "moonshotai/kimi-k2-0905",
    temperature,
    top_p,
    max_tokens,
    stop,
    signal,
    baseUrl = (typeof window !== "undefined" &&
      (window.OPENROUTER_API_BASE || "https://openrouter.ai/api/v1")) ||
      "https://openrouter.ai/api/v1",
    siteUrl = (typeof window !== "undefined" && window.OPENROUTER_SITE_URL) ||
      undefined,
    appName = (typeof window !== "undefined" && window.OPENROUTER_APP_NAME) ||
      undefined,
    extra = {},
  } = params || {};

  const { onDelta, onDone, onError } = handlers;

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("messages is required and must be a non-empty array");
  }
  if (!apiKey || typeof apiKey !== "string") {
    throw new Error("apiKey is required (OpenRouter API key)");
  }

  const url = String(baseUrl || "").replace(/\/+$/, "") + "/chat/completions";

  /** @type {any} */
  const body = {
    messages,
    model,
    temperature,
    top_p,
    max_tokens,
    stop,
    stream: true,
    ...extra,
  };

  // Remove undefined members to keep payload tidy
  Object.keys(body).forEach((k) => body[k] === undefined && delete body[k]);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...(siteUrl ? { "HTTP-Referer": siteUrl } : {}),
    ...(appName ? { "X-Title": appName } : {}),
  };

  const internalController =
    !signal || signal.aborted ? new AbortController() : null;
  const usedSignal = signal || internalController.signal;

  let reader = null;
  let closed = false;

  const promise = fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: usedSignal,
  })
    .then(async (res) => {
      if (!res.ok || !res.body) {
        const text = await safeText(res);
        throw new Error(`OpenRouter stream error (${res.status}): ${text}`);
      }

      reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      const pump = () => {
        if (!reader) return Promise.resolve();
        return reader.read().then(({ value, done }) => {
          if (done) {
            closed = true;
            try {
              onDone && onDone();
            } catch {}
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          // Normalize CRLF to LF to simplify parsing
          buffer = buffer.replace(/\r\n/g, "\n");

          // Process complete SSE events separated by blank lines
          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const rawChunk = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);

            // Each chunk can contain multiple "data:" lines
            const lines = rawChunk.split("\n").map((l) => l.trim());
            for (const line of lines) {
              if (!line.startsWith("data:")) continue;

              const payload = line.slice("data:".length).trim();
              if (payload === "[DONE]") {
                closed = true;
                try {
                  onDone && onDone();
                } catch {}
                // Ensure reader is released
                try {
                  reader.releaseLock();
                } catch {}
                reader = null;
                return;
              }

              try {
                const json = JSON.parse(payload);
                const delta = json?.choices?.[0]?.delta;
                if (delta?.content && onDelta) {
                  try {
                    onDelta(delta.content);
                  } catch {}
                }
              } catch {
                // Ignore keep-alives and partial lines
              }
            }

            boundary = buffer.indexOf("\n\n");
          }

          // Continue reading
          return pump();
        });
      };

      return pump();
    })
    .catch((err) => {
      if (closed) return;
      try {
        onError && onError(err);
      } catch {}
      throw err;
    })
    .finally(() => {
      // Cleanup
      try {
        reader && reader.releaseLock && reader.releaseLock();
      } catch {}
      reader = null;
    });

  return {
    cancel() {
      try {
        internalController && internalController.abort();
      } catch {}
      try {
        reader && reader.cancel && reader.cancel();
      } catch {}
    },
    promise,
  };
}

/**
 * Aggregates a streaming completion into a single string (callback-based under the hood).
 *
 * @param {StreamParams} params
 * @returns {Promise<string>}
 */
export function browserChatCompletionAggregated(params) {
  return new Promise((resolve, reject) => {
    let out = "";
    const ctl = browserStreamChatCompletion(params, {
      onDelta: (chunk) => {
        out += chunk;
      },
      onDone: () => resolve(out),
      onError: (err) => reject(err),
    });

    // If the provided signal is already aborted, abort immediately
    if (params && params.signal && params.signal.aborted) {
      try {
        ctl.cancel();
      } catch {}
    }
  });
}

/**
 * Removes triple-backtick code fences, including an optional language tag (e.g., ```html).
 * Safe to run on partial or complete strings; idempotent for simple usage.
 *
 * @param {string} s
 * @returns {string}
 */
export function stripTripleBacktickCodeFence(s) {
  if (typeof s !== "string") return "";
  let text = s.trim();

  if (text.startsWith("```")) {
    // Remove the first line (``` or ```lang)
    const firstNewline = text.indexOf("\n");
    if (firstNewline !== -1) {
      text = text.slice(firstNewline + 1);
    } else {
      text = text.replace(/^```[a-zA-Z0-9-]*\s*/g, "");
    }
  }

  // Remove trailing fence if present
  if (text.endsWith("```")) {
    const lastFence = text.lastIndexOf("```");
    if (lastFence !== -1) {
      text = text.slice(0, lastFence).trimEnd();
    }
  }

  return text;
}

/**
 * Best-effort to read a response body as text.
 * @param {Response} res
 * @returns {Promise<string>}
 */
async function safeText(res) {
  try {
    return await res.text();
  } catch {
    return "<no-body>";
  }
}
