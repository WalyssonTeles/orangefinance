import { describe, expect, it } from "vitest";
import { calendarDays, editDateInput, formatDateInput, isISODate, maskDateInput, monthLabel, parseISODate, shiftMonth, yearPage } from "./dates";

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

    describe("manual date entry", () => {
      it("adds separators progressively and keeps leading zeroes", () => {
        expect(["0", "09", "090", "0901", "09012", "090120", "0901202", "09012026"].map(maskDateInput))
          .toEqual(["0", "09", "09/0", "09/01", "09/01/2", "09/01/20", "09/01/202", "09/01/2026"]);
        expect(maskDateInput("09/01/2026 extra 99")).toBe("09/01/2026");
      });

      it("formats ISO values and preserves incomplete text", () => {
        expect(formatDateInput("2026-01-09")).toBe("09/01/2026");
        expect(formatDateInput("09/01/202")).toBe("09/01/202");
        expect(formatDateInput("")).toBe("");
      });

      it("converts a complete pasted date to ISO without losing the caret", () => {
        expect(editDateInput("", "09012026", 8, "insertFromPaste"))
          .toEqual({ text: "09/01/2026", value: "2026-01-09", caret: 10 });
      });

      it.each(["31/04/2026", "29/02/2027", "00/10/2026", "16/13/2026", "16/10/202"])(
        "keeps invalid or incomplete %s available for form validation",
        (text) => {
          const result = editDateInput("16/10/2026", text, text.length, "insertFromPaste");
          expect(result.value).toBe(text);
          expect(isISODate(result.value)).toBe(false);
        },
      );

      it("accepts leap days only in leap years", () => {
        expect(editDateInput("", "29022028", 8, "insertFromPaste").value).toBe("2028-02-29");
      });

      it("allows clearing the field instead of keeping the old date", () => {
        expect(editDateInput("16/10/2026", "", 0, "deleteContentBackward"))
          .toEqual({ text: "", value: "", caret: 0 });
      });

      it("handles backward and forward deletion across a separator", () => {
        expect(editDateInput("16/10/2026", "1610/2026", 2, "deleteContentBackward"))
          .toEqual({ text: "11/02/026", value: "11/02/026", caret: 1 });
        expect(editDateInput("16/10/2026", "1610/2026", 2, "deleteContentForward"))
          .toEqual({ text: "16/02/026", value: "16/02/026", caret: 2 });
      });

      it("preserves the caret when replacing the month in the middle", () => {
        const first = editDateInput("12/09/2026", "12/1/2026", 4, "insertText");
        expect(first.caret).toBe(4);
        const entered = first.text.slice(0, first.caret) + "0" + first.text.slice(first.caret);
        expect(editDateInput(first.text, entered, first.caret + 1, "insertText"))
          .toEqual({ text: "12/10/2026", value: "2026-10-12", caret: 5 });
      });
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
