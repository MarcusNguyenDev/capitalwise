import { joinClassNames } from "@/shared/ui/join_class_names.util";

interface BankBrandProps {
  bank_name: string;
  className?: string;
}

/** A neutral initial tile. Never renders a real bank's logo artwork. */
export function BankBrand({ bank_name, className }: BankBrandProps) {
  return (
    <span role="img" aria-label={bank_name} className={joinClassNames("flex h-8 w-10 shrink-0 items-center justify-center rounded-sm bg-accent text-xl font-bold text-white", className)}>
      {bank_name.charAt(0)}
    </span>
  );
}
