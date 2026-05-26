"use client";

import { useMemo, useState } from "react";

export type RecordPickerOption = {
  value: string;
  label: string;
  description?: string | null;
  badge?: string | null;
};

export type RecordPickerGroup = {
  label?: string;
  options: RecordPickerOption[];
};

type RecordPickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  groups: RecordPickerGroup[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  required?: boolean;
};

function optionText(option: RecordPickerOption) {
  return [option.label, option.description, option.badge]
    .filter(Boolean)
    .join(" ");
}

export function RecordPicker({
  label,
  value,
  onChange,
  groups,
  placeholder,
  searchPlaceholder,
  emptyMessage = "No matches found.",
  required,
}: RecordPickerProps) {
  const [query, setQuery] = useState("");

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return groups;

    return groups
      .map((group) => ({
        ...group,
        options: group.options.filter((option) =>
          optionText(option).toLowerCase().includes(normalizedQuery)
        ),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, query]);

  const selectedOption = groups
    .flatMap((group) => group.options)
    .find((option) => option.value === value);
  const hasOptions = filteredGroups.some((group) => group.options.length > 0);

  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
        className="w-full rounded-md border px-3 py-2"
        type="search"
      />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border px-3 py-2"
        required={required}
      >
        <option value="">{hasOptions ? placeholder : emptyMessage}</option>
        {filteredGroups.map((group, groupIndex) =>
          group.label ? (
            <optgroup key={`${group.label}-${groupIndex}`} label={group.label}>
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {optionText(option)}
                </option>
              ))}
            </optgroup>
          ) : (
            group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {optionText(option)}
              </option>
            ))
          )
        )}
      </select>
      {selectedOption ? (
        <span className="block text-xs text-muted-foreground">
          {[selectedOption.description, selectedOption.badge]
            .filter(Boolean)
            .join(" · ")}
        </span>
      ) : null}
    </label>
  );
}
