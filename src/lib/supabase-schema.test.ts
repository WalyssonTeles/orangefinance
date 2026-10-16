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

  it("upgrades to 1.1 without changing snapshots, codes or memberships and restricts renaming to shared-space owners", async () => {
    const snapshot = async () => (await postgres.query("select * from public.workspace_finance order by workspace_id")).rows;
    const memberships = async () => (await postgres.query("select * from public.finance_members order by workspace_id, user_id")).rows;
    const codes = async () => (await postgres.query("select id, join_code from public.finance_workspaces order by id")).rows;
    const before = { data: await snapshot(), members: await memberships(), codes: await codes() };
    await postgres.exec(sql("migrations", "202610160002_v1_1.sql"));
    await postgres.exec(sql("migrations", "202610160002_v1_1.sql"));
    await postgres.exec(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
      select public.rename_finance_workspace('00000000-0000-4000-8000-0000000000b1', '  Novo nome  ');
      commit;
    `);
    const names = await postgres.query<{ name: string }>("select name from public.finance_workspaces where id = '00000000-0000-4000-8000-0000000000b1'");
    expect(names.rows[0].name).toBe("Novo nome");
    expect({ data: await snapshot(), members: await memberships(), codes: await codes() }).toEqual(before);
    await postgres.exec(`
      begin;
      insert into auth.users(id, email) values ('00000000-0000-4000-8000-0000000000a2', 'v11-member@example.invalid');
      insert into public.finance_members(workspace_id, user_id, role)
        values ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a2', 'member');
      set local role authenticated;
      select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a2', true);
      do $$ begin
        begin
          perform public.rename_finance_workspace('00000000-0000-4000-8000-0000000000b1', 'Not allowed');
          raise exception 'A member renamed a shared space';
        exception when insufficient_privilege then null; end;
      end $$;
      select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
      do $$ begin
        begin
          perform public.rename_finance_workspace('00000000-0000-4000-8000-0000000000b1', '   ');
          raise exception 'An empty name was accepted';
        exception when invalid_parameter_value then null; end;
        begin
          perform public.rename_finance_workspace('00000000-0000-4000-8000-0000000000b1', repeat('x', 81));
          raise exception 'A long name was accepted';
        exception when invalid_parameter_value then null; end;
        begin
          perform public.rename_finance_workspace(public.ensure_personal_finance_workspace(), 'Renamed personal space');
          raise exception 'A personal space was renamed';
        exception when insufficient_privilege then null; end;
      end $$;
      select set_config('request.jwt.claim.sub', '', true);
      do $$ begin
        begin
          perform public.rename_finance_workspace('00000000-0000-4000-8000-0000000000b1', 'No session');
          raise exception 'Missing session accepted';
        exception when insufficient_privilege then null; end;
      end $$;
      set local role anon;
      do $$ begin
        begin
          perform public.rename_finance_workspace('00000000-0000-4000-8000-0000000000b1', 'Anonymous');
          raise exception 'Anonymous access accepted';
        exception when insufficient_privilege then null; end;
      end $$;
      rollback;
    `);
  }, 20_000);

  it("upgrades to 1.2 without changing snapshots and blocks old writers only after new semantics are used", async () => {
    const snapshot = async () => (await postgres.query("select * from public.workspace_finance order by workspace_id")).rows;
    const before = await snapshot();
    await postgres.exec(sql("migrations", "202610160003_v1_2.sql"));
    await postgres.exec(sql("migrations", "202610160003_v1_2.sql"));
    expect(await snapshot()).toEqual(before);
    await postgres.exec(`
      begin;
      set local role authenticated;
      select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', true);
      do $test$
      declare snapshot jsonb; rev bigint; space uuid := '00000000-0000-4000-8000-0000000000b1';
      begin
        select data, revision into snapshot, rev from public.workspace_finance where workspace_id = space;
        if not public.write_workspace_finance_v2(space, rev, snapshot) then raise exception 'Legacy writer failed'; end if;
        rev := rev + 1;
        snapshot := jsonb_set(snapshot, '{accounts}', '[{"id":"a","position":0,"closingDay":20,"dueDay":28}]');
        if not public.write_workspace_finance_v3(space, rev, snapshot) then raise exception '1.2 writer failed'; end if;
        if public.write_workspace_finance_v3(space, rev, snapshot) then raise exception 'Stale revision accepted'; end if;
        begin
          perform public.write_workspace_finance_v2(space, rev + 1, snapshot);
          raise exception 'Outdated writer accepted';
        exception when invalid_parameter_value then
          if sqlerrm not like '%Atualize%' then raise; end if;
        end;
      end $test$;
      select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000ffff', true);
      do $test$ begin
        begin
          perform public.write_workspace_finance_v3('00000000-0000-4000-8000-0000000000b1', 0, '{}');
          raise exception 'Nonmember accepted';
        exception when insufficient_privilege then null; end;
      end $test$;
      set local role anon;
      do $test$ begin
        begin
          perform public.write_workspace_finance_v3('00000000-0000-4000-8000-0000000000b1', 0, '{}');
          raise exception 'Anonymous accepted';
        exception when insufficient_privilege then null; end;
      end $test$;
      rollback;
    `);
    expect(await snapshot()).toEqual(before);
  }, 20_000);
});
