import type { ReactNode } from "react";

interface FilterBarProps {
  children: ReactNode;
  action?: string;
}

/**
 * A filter bar that submits as a GET form.
 * Every filter is a search param — clearing them returns the unfiltered view.
 */
export function FilterBar({ children, action = "." }: FilterBarProps) {
  return (
    <form method="get" action={action} className="flex flex-wrap gap-3 items-end">
      {children}
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm"
      >
        Apply
      </button>
      <a href={action} className="text-sm text-gray-500 hover:underline">
        Clear
      </a>
    </form>
  );
}

interface FilterFieldProps {
  label: string;
  name: string;
  type?: "text" | "select" | "date";
  value?: string;
  options?: Array<{ label: string; value: string }>;
  placeholder?: string;
}

export function FilterField({
  label,
  name,
  type = "text",
  value,
  options,
  placeholder,
}: FilterFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-500">{label}</span>
      {type === "select" ? (
        <select
          name={name}
          defaultValue={value ?? ""}
          className="border rounded px-2 py-1.5"
        >
          <option value="">All</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          defaultValue={value ?? ""}
          placeholder={placeholder}
          className="border rounded px-2 py-1.5"
        />
      )}
    </label>
  );
}
