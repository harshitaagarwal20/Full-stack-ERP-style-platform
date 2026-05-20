import { useEffect, useMemo, useRef, useState } from "react";

function normalizeText(value) {
  return String(value ?? "").toLowerCase().trim();
}

export default function SearchableSelect({ options = [], value, onChange, placeholder = "Select..." }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxIdRef = useRef(`searchable-select-${Math.random().toString(36).slice(2)}`);

  const selected = useMemo(
    () => options.find((option) => String(option.value) === String(value)) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const query = normalizeText(search);
    if (!query) return options;

    return options.filter((option) => {
      const searchableText = [option.label, option.value, option.searchText]
        .map(normalizeText)
        .join(" ");
      return searchableText.includes(query);
    });
  }, [options, search]);

  useEffect(() => {
    if (!open) return;

    function closeDropdown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
        setSearch("");
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", closeDropdown);
    return () => document.removeEventListener("mousedown", closeDropdown);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (!filtered.length) {
      setActiveIndex(-1);
      return;
    }

    const selectedIndex = filtered.findIndex((option) => String(option.value) === String(value));
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, filtered, value]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openDropdown() {
    setOpen(true);
    setSearch((prev) => prev || selected?.label || "");
    if (!("ontouchstart" in window)) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }

  function closeDropdown() {
    setOpen(false);
    setSearch("");
    setActiveIndex(-1);
  }

  function selectOption(option) {
    if (!option) return;
    onChange(option.value);
    setSearch(option.label || "");
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }
      setActiveIndex((prev) => Math.min(filtered.length - 1, prev < 0 ? 0 : prev + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }
      setActiveIndex((prev) => Math.max(0, prev > 0 ? prev - 1 : 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      if (!open) {
        openDropdown();
        return;
      }
      selectOption(filtered[activeIndex] || filtered[0]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
    }
  }

  return (
    <div ref={containerRef} className="enquiry-company-select" style={{ width: "100%" }}>
      <input
        ref={inputRef}
        type="text"
        value={open ? search : (search || selected?.label || "")}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxIdRef.current}
        aria-activedescendant={open && activeIndex >= 0 ? `${listboxIdRef.current}-option-${activeIndex}` : undefined}
        onFocus={() => {
          setOpen(true);
          setSearch(selected?.label || search);
        }}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />

      {open && (
        <div
          id={listboxIdRef.current}
          className="enquiry-company-select-menu"
          role="listbox"
        >
          {filtered.length ? (
            filtered.map((option, index) => {
              const isSelected = String(option.value) === String(value);
              const isActive = index === activeIndex;
              return (
                <button
                  key={option.value}
                  id={`${listboxIdRef.current}-option-${index}`}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  type="button"
                  className="enquiry-company-select-item"
                  role="option"
                  aria-selected={isSelected}
                  style={{
                    background: isSelected ? "#f0f9ff" : isActive ? "#f8fafc" : "#ffffff"
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                >
                  {option.label}
                </button>
              );
            })
          ) : (
            <div className="enquiry-company-select-empty">No matching records found</div>
          )}
        </div>
      )}
    </div>
  );
}
