import { neon } from "@neondatabase/serverless";

let cachedSql;

export function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

export function hasDatabase() {
  return Boolean(databaseUrl());
}

export function sql() {
  const url = databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (!cachedSql) cachedSql = neon(url);
  return cachedSql;
}

export function vectorLiteral(values) {
  if (!Array.isArray(values) || !values.length) return null;
  return `[${values.map((value) => Number(value).toFixed(8)).join(",")}]`;
}
