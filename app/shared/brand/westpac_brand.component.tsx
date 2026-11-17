import Image from "next/image";

import { joinClassNames } from "@/shared/ui/join_class_names.util";

interface WestpacBrandProps {
  bank_name: string;
  className?: string;
}

/** Official artwork for Westpac, while retaining configurable bank identities. */
export function WestpacBrand({ bank_name, className }: WestpacBrandProps) {
  if (bank_name.trim().toLowerCase() === "westpac") {
    return <Image src="/brand/westpac-logo.svg" alt="Westpac" width={69} height={28} className={joinClassNames("h-auto shrink-0", className ?? "w-[69px]")} />;
  }

  return (
    <span role="img" aria-label={bank_name} className={joinClassNames("flex h-8 w-10 shrink-0 items-center justify-center rounded-sm bg-accent text-xl font-bold text-white", className)}>
      {bank_name.charAt(0)}
    </span>
  );
}
