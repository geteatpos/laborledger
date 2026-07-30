import { BadRequestException } from "@nestjs/common";

const ID_PATTERN = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|c[a-z0-9]{20,}|[a-z0-9_-]{12,})$/iu;

export function requireBodyObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Request body must be an object.");
  }
  return value as Record<string, unknown>;
}

export function requireStringField(body: Record<string, unknown>, field: string, maxLength: number) {
  const value = body[field];
  if (typeof value !== "string" || !value.trim()) {
    throw new BadRequestException(`${field} is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new BadRequestException(`${field} is too long.`);
  }
  return trimmed;
}

export function optionalStringField(body: Record<string, unknown>, field: string, maxLength: number) {
  const value = body[field];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new BadRequestException(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    throw new BadRequestException(`${field} is too long.`);
  }
  return trimmed;
}

export function requireIdField(body: Record<string, unknown>, field: string) {
  const value = requireStringField(body, field, 128);
  if (!ID_PATTERN.test(value)) {
    throw new BadRequestException(`${field} is invalid.`);
  }
  return value;
}

export function optionalIdField(body: Record<string, unknown>, field: string) {
  const value = optionalStringField(body, field, 128);
  if (!value) return undefined;
  if (!ID_PATTERN.test(value)) {
    throw new BadRequestException(`${field} is invalid.`);
  }
  return value;
}

export function optionalDateField(body: Record<string, unknown>, field: string) {
  const value = optionalStringField(body, field, 64);
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid date.`);
  }
  return value;
}
