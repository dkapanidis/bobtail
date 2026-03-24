import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";

interface Props {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  compact?: boolean;
}

export interface FilterInputHandle {
  toggle: () => void;
}

const FilterInput = forwardRef<FilterInputHandle, Props>(
  function FilterInput({ label, value, options, onChange, compact }, forwardedRef) {
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    useImperativeHandle(forwardedRef, () => ({
      toggle() {
        setOpen((o) => {
          if (!o) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
          return !o;
        });
      },
    }));

    const filtered = options.filter((o) =>
      o.toLowerCase().includes(value.toLowerCase()),
    );

    useEffect(() => {
      setHighlighted(-1);
    }, [value]);

    useEffect(() => {
      function handleClick(e: MouseEvent) {
        if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    function handleKeyDown(e: React.KeyboardEvent) {
      if (!open || filtered.length === 0) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          setOpen(true);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlighted((h) => Math.max(h - 1, -1));
          break;
        case "Enter":
          e.preventDefault();
          if (highlighted >= 0 && highlighted < filtered.length) {
            onChange(filtered[highlighted]);
          } else if (value && filtered.length > 0) {
            onChange(filtered[0]);
          }
          setOpen(false);
          break;
        case "Escape":
          setOpen(false);
          setHighlighted(-1);
          break;
        case "Tab":
          if (highlighted >= 0 && highlighted < filtered.length) {
            onChange(filtered[highlighted]);
          }
          setOpen(false);
          break;
      }
    }

    useEffect(() => {
      if (highlighted >= 0 && listRef.current) {
        const items = listRef.current.querySelectorAll("[data-option]");
        items[highlighted]?.scrollIntoView({ block: "nearest" });
      }
    }, [highlighted]);

    if (compact) {
      // Headless mode: no visible input, just the dropdown when open
      if (!open) return null;
      return (
        <div ref={wrapperRef} className="absolute z-20 mt-1 left-0 min-w-[12rem]">
          <input
            ref={inputRef}
            className="w-full border rounded px-2 py-1 text-xs bg-white dark:bg-gray-700 dark:border-gray-600 placeholder:text-gray-400"
            placeholder={`Filter ${label}...`}
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {filtered.length > 0 && (
            <ul
              ref={listRef}
              className="mt-1 w-full bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto text-sm"
            >
              {value && (
                <li
                  className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-gray-400 italic"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                >
                  Clear filter
                </li>
              )}
              {filtered.map((o, i) => (
                <li
                  key={o}
                  data-option
                  className={`px-3 py-1.5 cursor-pointer ${
                    i === highlighted
                      ? "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100"
                      : o === value
                        ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium"
                        : "hover:bg-gray-100 dark:hover:bg-gray-600"
                  }`}
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                >
                  {highlightMatch(o, value)}
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    }

    // Standard mode: visible input with dropdown
    return (
      <div ref={wrapperRef} className="relative">
        <input
          ref={inputRef}
          className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600 w-44"
          placeholder={`Filter ${label}...`}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {open && filtered.length > 0 && (
          <ul
            ref={listRef}
            className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto text-sm min-w-[10rem]"
          >
            {value && (
              <li
                className="px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-gray-400 italic"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear filter
              </li>
            )}
            {filtered.map((o, i) => (
              <li
                key={o}
                data-option
                className={`px-3 py-1.5 cursor-pointer ${
                  i === highlighted
                    ? "bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100"
                    : o === value
                      ? "bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-200 font-medium"
                      : "hover:bg-gray-100 dark:hover:bg-gray-600"
                }`}
                onClick={() => {
                  onChange(o);
                  setOpen(false);
                }}
                onMouseEnter={() => setHighlighted(i)}
              >
                {highlightMatch(o, value)}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);

export default FilterInput;

function highlightMatch(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-bold underline">
        {text.slice(idx, idx + query.length)}
      </span>
      {text.slice(idx + query.length)}
    </>
  );
}
