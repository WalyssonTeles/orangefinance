import "fake-indexeddb/auto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import { FinanceDB } from "./db";
import { readProfile, saveProfileLocally, syncProfile, validateProfile } from "./profile";

const databases: FinanceDB[] = [];
afterEach(async () => {
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});

function database() {
  const db = new FinanceDB(`profile-test-${crypto.randomUUID()}`);
  databases.push(db);
  return db;
}

type Row = { display_name: string | null; gender: string | null; birth_date: string | null; updated_at: string };

function fakeServer(initial: Row | null) {
  const state = { row: initial, saves: 0 };
  const client = {
    rpc(name: string, args?: Record<string, unknown>) {
      const result = async () => {
        if (name === "get_finance_profile") return { data: state.row ? [state.row] : [], error: null };
        if (name === "save_finance_profile") {
          state.saves++;
          state.row = {
            display_name: args!.p_display_name as string, gender: args!.p_gender as string | null,
            birth_date: args!.p_birth_date as string | null, updated_at: new Date().toISOString(),
          };
          return { data: state.row.updated_at, error: null };
        }
        return { data: null, error: { message: `unexpected ${name}` } };
      };
      return { setHeader: () => result() };
    },
  } as unknown as SupabaseClient;
  return { client, state };
}

describe("profile", () => {
  it("validates birth date and name length", () => {
    expect(validateProfile({ name: "Ana", gender: null, birthDate: "2999-01-01" })).toMatch(/futuro/);
    expect(validateProfile({ name: "Ana", gender: null, birthDate: "1899-12-31" })).toMatch(/válida/);
    expect(validateProfile({ name: "x".repeat(41), gender: null, birthDate: null })).toMatch(/40/);
    expect(validateProfile({ name: "Ana", gender: "female", birthDate: "1990-02-03" })).toBeNull();
  });

  it("uploads pending local edits instead of replacing them with the account copy", async () => {
    const db = database();
    const { client, state } = fakeServer({ display_name: "Antigo", gender: null, birth_date: null, updated_at: "2026-01-01T00:00:00Z" });
    await saveProfileLocally({ name: "Novo", gender: "male", birthDate: "1990-05-01" }, "user-a", db);
    await syncProfile(client, "token", "user-a", db);
    expect(state.row?.display_name).toBe("Novo");
    expect(await readProfile(db)).toMatchObject({ name: "Novo", gender: "male", pending: false, userId: "user-a" });
  });

  it("downloads the account profile on a new device", async () => {
    const db = database();
    const { client, state } = fakeServer({ display_name: "Walysson", gender: "male", birth_date: "1990-05-01", updated_at: "2026-01-01T00:00:00Z" });
    await syncProfile(client, "token", "user-a", db);
    expect(state.saves).toBe(0);
    expect(await readProfile(db)).toMatchObject({ name: "Walysson", birthDate: "1990-05-01", pending: false, userId: "user-a" });
  });

  it("uploads a profile filled before signing in only when the account has none", async () => {
    const db = database();
    await saveProfileLocally({ name: "Antes do login", gender: null, birthDate: null }, null, db);
    const empty = fakeServer(null);
    await syncProfile(empty.client, "token", "user-a", db);
    expect(empty.state.row?.display_name).toBe("Antes do login");

    const other = database();
    await saveProfileLocally({ name: "Rascunho", gender: null, birthDate: null }, null, other);
    const existing = fakeServer({ display_name: "Na conta", gender: null, birth_date: null, updated_at: "2026-01-01T00:00:00Z" });
    await syncProfile(existing.client, "token", "user-a", other);
    expect(existing.state.saves).toBe(0);
    expect((await readProfile(other))?.name).toBe("Na conta");
  });
});
