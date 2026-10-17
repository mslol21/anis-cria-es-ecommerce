import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCentsToBRL(cents: number): string {
  const value = cents / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function normalizePostalCode(cep: string): string {
  return cep.replace(/\D/g, '').slice(0, 8);
}

export function formatPostalCode(cep: string): string {
  const digits = normalizePostalCode(cep);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5, 8)}`;
}

export function normalizeDocument(doc: string): string {
  return doc.replace(/\D/g, '').slice(0, 14);
}

export function isValidCpfOrCnpj(doc: string): boolean {
  const digits = normalizeDocument(doc);
  if (digits.length !== 11 && digits.length !== 14) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatBusinessDays(days: number): string {
  if (days <= 0) return 'Pronta entrega (envio imediato)';
  if (days === 1) return '1 dia útil';
  return `${days} dias úteis`;
}

export function maskSensitiveData(input: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'document', 'cpf', 'cnpj', 'card', 'cvv'];
  for (const [key, val] of Object.entries(input)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
      masked[key] = '[REDACTED]';
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      masked[key] = maskSensitiveData(val as Record<string, unknown>);
    } else {
      masked[key] = val;
    }
  }
  return masked;
}
