export class HttpError extends Error {
  constructor(message, { status = 0, url = '' } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchJson(url, {
  headers = {},
  method = 'GET',
  body,
  timeoutMs = 15000,
  retries = 2,
  fetchImpl = globalThis.fetch,
} = {}) {
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const request = { method, headers, signal: AbortSignal.timeout(timeoutMs) };
      if (body !== undefined) request.body = body;
      const response = await fetchImpl(url, request);
      if (!response.ok) {
        throw new HttpError(`HTTP ${response.status}`, { status: response.status, url });
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      const status = error instanceof HttpError ? error.status : 0;
      const retryable = status === 0 || status === 429 || status >= 500;
      if (!retryable || attempt === retries) break;
      await sleep(400 * 2 ** attempt);
    }
  }

  throw lastError instanceof Error ? lastError : new HttpError('请求失败', { url });
}

export const USER_AGENT = 'tech-radar/1.0 (+https://everwynn.github.io/tech-radar/)';
