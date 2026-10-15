import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let postgres: PGlite;
const sql = (folder: string, file: string) => readFileSync(resolve(process.cwd(), "supabase", folder, file), "utf8");

beforeAll(async () => {
  postgres = new PGlite();
  await postgres.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  await postgres.exec(sql("migrations", "202610150001_finance_sync.sql"));
  await postgres.exec(sql("migrations", "202610150002_workspaces.sql"));
}, 60_000);

afterAll(async () => { await postgres?.close(); });

describe("Supabase PostgreSQL permissions", () => {
  it("enforces user isolation, anonymous denial and compare-and-swap in the original migration", async () => {
    const results = await postgres.exec(sql("tests", "rls.sql"));
    expect(JSON.stringify(results.at(-1)?.rows)).toContain("PASS:");
  }, 20_000);

  it("isolates private/family data and enforces invitations, revocation and concurrent revisions", async () => {
    const results = await postgres.exec(sql("tests", "workspaces.sql"));
    expect(JSON.stringify(results.at(-1)?.rows)).toContain("PASS:");
  }, 20_000);

  it("can rerun both migrations without dropping financial data", async () => {
    await postgres.exec(sql("migrations", "202610150001_finance_sync.sql"));
    await postgres.exec(sql("migrations", "202610150002_workspaces.sql"));
    const result = await postgres.query<{ count: number }>(
      "select count(*)::integer as count from pg_policies where tablename = 'workspace_finance'",
    );
    expect(result.rows[0].count).toBe(1);
  }, 20_000);
});
