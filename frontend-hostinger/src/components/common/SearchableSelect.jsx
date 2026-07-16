import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Below this the menu is too cramped to be usable, so it flips instead of
// squeezing; above it there is no point growing further.
const MENU_MIN_HEIGHT = 140;
const MENU_MAX_HEIGHT = 220;

function normalizeText(value) {
  return String(value ?? "").toLowerCase().trim();
}

export default function SearchableSelect({ options = [], value, onChange, placeholder = "Select...", allowCustom = false }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxIdRef = useRef(`searchable-select-${Math.random().toString(36).slice(2)}`);
  const menuRef = useRef(null);
  const [menuRect, setMenuRect] = useState(null);

  // Fall back to a case-insensitive match so a saved value whose casing drifted
  // from the master list still shows up as the selected option instead of blank.
  const selected = useMemo(() => {
    if (value == null || value === "") return null;
    return (
      options.find((option) => String(option.value) === String(value))
      || options.find((option) => normalizeText(option.value) === normalizeText(value))
      || null
    );
  }, [options, value]);

  const filtered = useMemo(() => {
    const query = normalizeText(search);
    const selectedQuery = normalizeText(selected?.label);
    if (!query) return options;
    if (open && !allowCustom && query === selectedQuery) return options;

    return options.filter((option) => {
      const searchableText = [option.label, option.value, option.searchText]
        .map(normalizeText)
        .join(" ");
      return searchableText.includes(query);
    });
  }, [allowCustom, open, options, search, selected?.label]);

  useEffect(() => {
    if (!open) return;

    function closeDropdown(event) {
      const insideContainer = containerRef.current && containerRef.current.contains(event.target);
      const insideMenu = menuRef.current && menuRef.current.contains(event.target);
      if (!insideContainer && !insideMenu) {
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

    const selectedIndex = filtered.findIndex((option) => option.value === selected?.value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, filtered, selected]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  // The menu is portaled and positioned in viewport coordinates, so it has to
  // place itself: drop below the input when there is room, flip above when
  // there isn't (otherwise it runs off the bottom and sits over the page), and
  // stay inside the left/right edges rather than overflowing them.
  useLayoutEffect(() => {
    if (!open) return;

    function updateRect() {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;

      const GAP = 6;
      const MARGIN = 8;
      const spaceBelow = window.innerHeight - rect.bottom - GAP - MARGIN;
      const spaceAbove = rect.top - GAP - MARGIN;
      const flipUp = spaceBelow < MENU_MIN_HEIGHT && spaceAbove > spaceBelow;

      const width = Math.min(rect.width, window.innerWidth - MARGIN * 2);
      const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - width - MARGIN));
      const maxHeight = Math.max(
        MENU_MIN_HEIGHT,
        Math.min(MENU_MAX_HEIGHT, flipUp ? spaceAbove : spaceBelow)
      );

      setMenuRect({
        width,
        left,
        maxHeight,
        top: flipUp ? undefined : rect.bottom + GAP,
        bottom: flipUp ? window.innerHeight - rect.top + GAP : undefined
      });
    }

    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open]);

  useEffect(() => {
    if (open) return;
    // Show the raw value when it matches no option (master data not loaded yet,
    // or the option was retired) rather than silently rendering an empty box.
    setSearch(selected?.label ?? String(value ?? ""));
  }, [open, selected, value]);

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
      const match = filtered[activeIndex] || filtered[0];
      if (match) {
        selectOption(match);
      } else if (allowCustom) {
        setOpen(false);
      }
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
        value={search}
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
          if (allowCustom) onChange(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />

      {open && menuRect && createPortal(
        <div
          ref={menuRef}
          id={listboxIdRef.current}
          className="enquiry-company-select-menu"
          role="listbox"
          style={{
            position: "fixed",
            top: menuRect.top,
            bottom: menuRect.bottom,
            left: menuRect.left,
            width: menuRect.width,
            maxHeight: menuRect.maxHeight
          }}
        >
          {filtered.length ? (
            filtered.map((option, index) => {
              const isSelected = option.value === selected?.value;
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
        </div>,
        document.body
      )}
    </div>
  );
}
