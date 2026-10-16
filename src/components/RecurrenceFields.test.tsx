import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SELECTABLE_FREQUENCIES, recurrenceHint, validateRepeat } from "../lib/recurrence";
import { RecurrenceFields } from "./RecurrenceFields";

describe("concise recurrence hints", () => {
  it.each([
    ["daily", "Dia após dia"],
    ["weekly", "Toda segunda-feira"],
    ["fortnightly", "Segunda sim, segunda não"],
    ["monthly", "Todo dia 16 do mês"],
    ["yearly", "Todo dia 16 de outubro"],
  ] as const)("%s follows the selected date", (frequency, expected) => {
    expect(recurrenceHint("2028-10-16", frequency)).toBe(expected);
  });
  it("updates weekdays and uses the appropriate grammatical gender", () => {
    expect(recurrenceHint("2026-10-16", "weekly")).toBe("Toda sexta-feira");
    expect(recurrenceHint("2026-10-17", "weekly")).toBe("Todo sábado");
    expect(recurrenceHint("2026-10-18", "weekly")).toBe("Todo domingo");
    expect(recurrenceHint("2026-10-17", "fortnightly")).toBe("Sábado sim, sábado não");
    expect(recurrenceHint("2028-02-29", "yearly")).toBe("Todo dia 29 de fevereiro");
  });
  it("does not describe dates that are still incomplete or invalid", () => {
    expect(recurrenceHint("16/1", "weekly")).toBeUndefined();
    expect(recurrenceHint("2026-02-31", "monthly")).toBeUndefined();
  });
  it("places frequency before occurrence count without changing the quantity hint", () => {
    const html = renderToStaticMarkup(<RecurrenceFields date="2028-10-16" value={{ mode: "recurring", frequency: "weekly", count: 12 }} onChange={() => {}} />);
    expect(html.indexOf("Frequência")).toBeLessThan(html.indexOf("Quantidade de ocorrências"));
    expect(html).toContain("Toda segunda-feira");
    expect(html).toContain("Inclui este lançamento. Ex.: 12 ocorrências semanais = um lançamento por semana, durante 12 semanas.");
  });
  it("removes custom creation choices without invalidating existing custom series", () => {
    expect(SELECTABLE_FREQUENCIES.map((item) => item.value)).toEqual(["daily", "weekly", "fortnightly", "monthly", "yearly"]);
    expect(() => validateRepeat({ mode: "recurring", frequency: "custom", intervalDays: 10, count: 12 })).not.toThrow();
    const html = renderToStaticMarkup(<RecurrenceFields date="2028-10-16" value={{ mode: "recurring", frequency: "custom", intervalDays: 10, count: 12 }} onChange={() => {}} />);
    expect(html).toContain("Personalizado");
    expect(html).toContain('value="10"');
  });
});
