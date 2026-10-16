import { describe, expect, it } from "vitest";
import { calendarDays, isISODate, monthLabel, parseISODate, shiftMonth, yearPage } from "./dates";

describe("month and year selection", () => {
  it("moves exactly one month across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthLabel("2026-10")).toBe("Outubro de 2026");
  });

  describe("day calendar", () => {
    it("starts weeks on Sunday and ends on Saturday, including adjacent dates", () => {
      const days = calendarDays("2026-10");
      expect(days).toHaveLength(35);
      expect(days[0]).toBe("2026-09-27");
      expect(days[34]).toBe("2026-10-31");
      expect(days[4]).toBe("2026-10-01");
      expect(parseISODate(days[0]!).getDay()).toBe(0);
      expect(parseISODate(days[34]!).getDay()).toBe(6);
    });

    it("uses only the weeks needed, including four- and six-week months", () => {
      expect(calendarDays("2026-02")).toHaveLength(28);
      expect(calendarDays("2026-08")).toHaveLength(42);
    });

    it("handles leap years and year boundaries without UTC date shifts", () => {
      expect(calendarDays("2028-02")).toContain("2028-02-29");
      expect(calendarDays("2027-02")).not.toContain("2027-02-29");
      expect(calendarDays("2026-12").at(-1)).toBe("2027-01-02");
      expect(calendarDays("2027-01")[0]).toBe("2026-12-27");
    });

    it("never produces an invalid ISO date at the supported year boundaries", () => {
      for (const month of ["1000-01", "9999-12"]) {
        const days = calendarDays(month);
        expect(days).toContain(null);
        expect(days.filter((date) => date !== null).every(isISODate)).toBe(true);
        expect(days).toContain(`${month}-01`);
      }
    });

    it("rejects invalid months instead of rendering a misleading calendar", () => {
      for (const month of ["", "2026-13", "2026-2", "2026-00", "invalid"]) {
        expect(() => calendarDays(month)).toThrow("Informe um mês válido para o calendário.");
      }
    });
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
