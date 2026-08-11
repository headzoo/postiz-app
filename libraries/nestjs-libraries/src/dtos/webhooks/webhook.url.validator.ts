import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { URL } from 'node:url';
import dns from 'node:dns/promises';
import net from 'node:net';

export function isBlockedIPv4(ip: string): boolean {
  const [a, b, c] = ip.split('.').map(Number);

  if ([a, b, c].some((n) => Number.isNaN(n))) return true;

  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8
    a === 127 || // 127.0.0.0/8
    (a === 169 && b === 254) || // 169.254.0.0/16
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF/docs
    (a === 192 && b === 88 && c === 99) || // deprecated relay anycast
    (a === 198 && b === 51 && c === 100) || // documentation
    (a === 203 && b === 0 && c === 113) || // documentation
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15
    a >= 224 // multicast/reserved
  );
}

export function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  const groups = normalized.split(':');
  const firstGroup = Number.parseInt(groups[0] || '0', 16);
  const secondGroup = Number.parseInt(groups[1] || '0', 16);

  return (
    firstGroup < 0x2000 ||
    firstGroup > 0x3fff || // only global unicast 2000::/3
    (firstGroup === 0x2001 && secondGroup <= 0x01ff) || // protocol assignments
    (firstGroup === 0x2001 && secondGroup === 0x0db8) || // documentation
    firstGroup === 0x2002 || // deprecated 6to4
    (firstGroup === 0x3fff && secondGroup <= 0x0fff) || // documentation
    normalized === '::1' || // loopback
    normalized === '::' || // unspecified
    normalized.startsWith('fe80:') || // link-local
    normalized.startsWith('fc') || // unique local fc00::/7
    normalized.startsWith('fd') || // unique local fd00::/7
    normalized.startsWith('fec') || // deprecated site-local fec0::/10
    normalized.startsWith('fed') ||
    normalized.startsWith('fee') ||
    normalized.startsWith('fef') ||
    normalized.startsWith('2001:db8:') || // documentation
    normalized.startsWith('ff') // multicast
  );
}

export function isBlockedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    return isBlockedIPv4(ip);
  }
  if (version === 6) {
    // IPv4-mapped IPv6 (::ffff:a.b.c.d) — extract and check as IPv4
    const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) {
      return isBlockedIPv4(mapped[1]);
    }
    const mappedHex = ip
      .toLowerCase()
      .match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const high = Number.parseInt(mappedHex[1], 16);
      const low = Number.parseInt(mappedHex[2], 16);
      return isBlockedIPv4(
        `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`
      );
    }
    return isBlockedIPv6(ip);
  }
  return true;
}

async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return false;
  }

  if (net.isIP(hostname)) {
    return !isBlockedIp(hostname);
  }

  try {
    const records = await dns.lookup(hostname, { all: true });
    return (
      records.length > 0 &&
      records.every((record) => !isBlockedIp(record.address))
    );
  } catch {
    return false;
  }
}

export async function isSafePublicHttpsUrl(value: unknown): Promise<boolean> {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') {
    return false;
  }

  if (!parsed.hostname) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return resolvesToPublicAddress(hostname);
}

export async function isSafePublicHttpUrl(value: unknown): Promise<boolean> {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password
  ) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return resolvesToPublicAddress(hostname);
}

@ValidatorConstraint({ name: 'IsSafeWebhookUrl', async: true })
export class IsSafeWebhookUrlConstraint
  implements ValidatorConstraintInterface
{
  async validate(value: unknown, _args: ValidationArguments): Promise<boolean> {
    return isSafePublicHttpsUrl(value);
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'URL must be a public HTTPS URL and must not resolve to localhost, private, loopback, or link-local addresses';
  }
}

export function IsSafeWebhookUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsSafeWebhookUrlConstraint,
    });
  };
}

@ValidatorConstraint({ name: 'IsSafePublicHttpUrl', async: true })
export class IsSafePublicHttpUrlConstraint
  implements ValidatorConstraintInterface
{
  async validate(value: unknown, _args: ValidationArguments): Promise<boolean> {
    return isSafePublicHttpUrl(value);
  }

  defaultMessage(_args: ValidationArguments): string {
    return 'URL must be a credential-free public HTTP(S) URL and must not resolve to localhost, private, loopback, link-local, or reserved addresses';
  }
}

export function IsSafePublicHttpUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: IsSafePublicHttpUrlConstraint,
    });
  };
}
