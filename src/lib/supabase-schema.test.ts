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
    create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb not null default '{}');
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

  it("upgrades to 1.0 preserving existing financial snapshots and backfilling join codes", async () => {
    await postgres.exec(`
      insert into auth.users(id, email) values ('00000000-0000-4000-8000-0000000000a1', 'existing@example.invalid');
      insert into public.finance_workspaces(id, owner_id, name, kind)
        values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'Família existente', 'shared');
      insert into public.finance_members(workspace_id, user_id, role)
        values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'owner');
      insert into public.workspace_finance(workspace_id, revision, data) values ('00000000-0000-4000-8000-0000000000b1', 7,
        '{"accounts":[{"id":"a"}],"categories":[],"transactions":[{"id":"t","amount":100}],"budgets":[],"settings":[]}');
    `);
    const before = await postgres.query<{ data: unknown; revision: number }>("select data, revision from public.workspace_finance");
    await postgres.exec(sql("migrations", "202610160001_v1.sql"));
    await postgres.exec(sql("migrations", "202610160001_v1.sql"));
    const after = await postgres.query<{ data: unknown; revision: number }>("select data, revision from public.workspace_finance");
    expect(after.rows).toEqual(before.rows);
    const code = await postgres.query<{ join_code: string }>(
      "select join_code from public.finance_workspaces where id = '00000000-0000-4000-8000-0000000000b1'",
    );
    expect(code.rows[0].join_code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
  }, 20_000);

  it("enforces 1.0 profiles privacy, join codes, throttling and blocks outdated writers", async () => {
    const results = await postgres.exec(sql("tests", "v1.sql"));
    expect(JSON.stringify(results.at(-1)?.rows)).toContain("PASS:");
  }, 20_000);
});
