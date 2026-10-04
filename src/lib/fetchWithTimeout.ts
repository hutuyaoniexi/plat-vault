import {NETWORK_REQUEST_TIMEOUT_MS} from '../shared/constants';

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = NETWORK_REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const parentSignal = init.signal;
  if (parentSignal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
  const abortFromParent = () => controller.abort();
  parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    // Keep the deadline active until the body is fully received; fetch() alone
    // only waits for response headers.
    // Lightweight fetch mocks may expose only the methods used by the caller.
    if (typeof response.arrayBuffer !== 'function') return response;
    const body = await response.arrayBuffer();
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  } catch (error) {
    if (parentSignal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
    if (timedOut) throw new Error('网络请求超时，请检查网络后重试');
    throw error;
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener('abort', abortFromParent);
  }
}
