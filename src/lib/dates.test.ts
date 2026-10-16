import { describe, expect, it } from "vitest";
import { monthLabel, shiftMonth, yearPage } from "./dates";

describe("month and year selection", () => {
  it("moves exactly one month across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthLabel("2026-10")).toBe("Outubro de 2026");
  });

  it("shows twelve years ending at the current year", () => {
    expect(yearPage(2026, 2026)).toEqual(Array.from({ length: 12 }, (_, i) => 2015 + i));
    expect(yearPage(2020, 2026)).toEqual(yearPage(2026, 2026));
  });

  it("pages without skipping or repeating years in either direction", () => {
    expect(yearPage(2014, 2026)).toEqual(Array.from({ length: 12 }, (_, i) => 2003 + i));
    expect(yearPage(2002, 2026)).toEqual(Array.from({ length: 12 }, (_, i) => 1991 + i));
    expect(yearPage(2027, 2026)).toEqual(Array.from({ length: 12 }, (_, i) => 2027 + i));
  });
});
