import { formatCodeLabel, formatCurrency } from "@/shared/format/format_values.util";
import type { EngineCase } from "@/shared/types/case.type";

import { ARRANGEMENT_TYPES, MAX_ARRANGEMENT_MONTHS } from "../constants/editable_params.constant";
import { readFeeAmount } from "../utils/read_case_params.util";

const FIELD_CLASS_NAME = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-lg font-semibold";

interface EditParamsFieldsProps {
  engine_case: EngineCase;
  edited_params: Record<string, unknown>;
  onChange: (edited_params: Record<string, unknown>) => void;
}

function RefundAmountField({ engine_case, edited_params, onChange }: EditParamsFieldsProps) {
  const fee_amount = readFeeAmount(engine_case);
  return (
    <label className="block max-w-xs">
      <span className="font-semibold">Refund amount{fee_amount === null ? "" : ` (up to ${formatCurrency(fee_amount)})`}</span>
      <input
        type="number"
        min={0.01}
        max={fee_amount ?? undefined}
        step={0.01}
        className={FIELD_CLASS_NAME}
        value={String(edited_params.amount ?? "")}
        onChange={(change_event) => onChange({ ...edited_params, amount: Number(change_event.target.value) })}
      />
    </label>
  );
}

function HardshipTermsFields({ edited_params, onChange }: EditParamsFieldsProps) {
  return (
    <div className="grid max-w-xl grid-cols-2 gap-4">
      <label className="block">
        <span className="font-semibold">Arrangement</span>
        <select
          className={FIELD_CLASS_NAME}
          value={String(edited_params.arrangement_type ?? "")}
          onChange={(change_event) => onChange({ ...edited_params, arrangement_type: change_event.target.value })}
        >
          {ARRANGEMENT_TYPES.map((arrangement_type) => (
            <option key={arrangement_type} value={arrangement_type}>
              {formatCodeLabel(arrangement_type)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-semibold">Months</span>
        <input
          type="number"
          min={1}
          max={MAX_ARRANGEMENT_MONTHS}
          step={1}
          className={FIELD_CLASS_NAME}
          value={String(edited_params.months ?? "")}
          onChange={(change_event) => onChange({ ...edited_params, months: Number(change_event.target.value) })}
        />
      </label>
    </div>
  );
}

/** The terms a reviewer may adjust before approving. Policy still applies to the edited values. */
export function EditParamsFields(edit_props: EditParamsFieldsProps) {
  return edit_props.engine_case.action_code === "REFUND_FEE" ? <RefundAmountField {...edit_props} /> : <HardshipTermsFields {...edit_props} />;
}
