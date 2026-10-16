import { shortDate } from "../lib/dates";
import { FREQUENCIES, occurrenceDate, type Repeat } from "../lib/recurrence";
import { Select } from "./Select";
import { Field, inputClass, Segmented } from "./ui";

export function RecurrenceFields({ value, onChange, date }: { value: Repeat; onChange: (value: Repeat) => void; date: string }) {
  const repeating = value.mode !== "none";
  const count = value.count;
  const preview = repeating && /^\d{4}-\d{2}-\d{2}$/.test(date) && count >= 1 && count <= 1200 &&
    (value.mode !== "recurring" || value.frequency !== "custom" || (value.intervalDays ?? 0) > 0);
  return (
    <div className="space-y-3">
      <Segmented label="Repetição" value={value.mode} onChange={(mode) => onChange({ ...value, mode })} options={[
        { value: "none", label: "Única" }, { value: "installments", label: "Parcelada" }, { value: "recurring", label: "Recorrente" },
      ]} />
      {repeating && (
        <>
          <Field label={value.mode === "installments" ? "Número de parcelas" : "Quantidade de ocorrências"}
            hint={value.mode === "installments" ? "O valor informado será dividido entre as parcelas mensais." : "Inclui este lançamento. Ex.: 12 ocorrências semanais = um lançamento por semana, durante 12 semanas."}>
            <input type="number" required min={1} max={1200} className={inputClass} value={count || ""} onChange={(event) => onChange({ ...value, count: Number(event.target.value) })} />
          </Field>
          {value.mode === "recurring" && (
            <Field label="Frequência">
              <Select label="Frequência" value={value.frequency ?? "monthly"} options={FREQUENCIES} onChange={(selected) => {
                const frequency = FREQUENCIES.find((item) => item.value === selected)?.value;
                if (frequency) onChange({ ...value, frequency });
              }} />
            </Field>
          )}
          {value.mode === "recurring" && value.frequency === "custom" && (
            <Field label="Intervalo em dias">
              <input type="number" required min={1} max={3650} className={inputClass} value={value.intervalDays || ""} onChange={(event) => onChange({ ...value, intervalDays: Number(event.target.value) })} />
            </Field>
          )}
          {preview && <p className="text-xs text-muted">Datas: {Array.from({ length: Math.min(count, 3) }, (_, index) => shortDate(occurrenceDate(date, index, value))).join(" · ")}{count > 3 ? ` · … · ${shortDate(occurrenceDate(date, count - 1, value))}` : ""}. Os próximos lançamentos ficam pendentes.</p>}
        </>
      )}
    </div>
  );
}
