export async function getLocal<T>(key: string): Promise<T | undefined> {
  if (globalThis.chrome?.storage?.local) return (await chrome.storage.local.get(key))[key] as T | undefined;
  const value = localStorage.getItem(key);
  return value ? JSON.parse(value) as T : undefined;
}

export async function setLocal<T>(key: string, value: T): Promise<void> {
  if (globalThis.chrome?.storage?.local) { await chrome.storage.local.set({ [key]: value }); return; }
  localStorage.setItem(key, JSON.stringify(value));
}
