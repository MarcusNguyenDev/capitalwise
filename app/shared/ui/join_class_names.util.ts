/** Joins the truthy class names: joinClassNames("a", is_open && "b") -> "a b". */
export function joinClassNames(...class_names: (string | false | null | undefined)[]): string {
  return class_names.filter(Boolean).join(" ");
}
