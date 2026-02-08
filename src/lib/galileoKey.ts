const GALILEO_KEY = "saggiatore_galileo_key";

export function getGalileoKey(): string | null {
  return localStorage.getItem(GALILEO_KEY);
}

export function setGalileoKey(key: string): void {
  localStorage.setItem(GALILEO_KEY, key);
}

export function clearGalileoKey(): void {
  localStorage.removeItem(GALILEO_KEY);
}
