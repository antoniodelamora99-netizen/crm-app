"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import type { Client } from "@/lib/types";

export function ClientQuickSelect({
  clients,
  value,
  onChange,
  max = 30,
  placeholder = "Nombre del cliente",
  autoFocus = false,
}: {
  clients: Client[];
  value?: string;
  onChange: (id: string) => void;
  max?: number;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [highlight, setHighlight] = useState(0);
  const selected = clients.find((c) => c.id === value);
  const display = selected
    ? `${selected.nombre} ${selected.apellidoPaterno || ""} ${selected.apellidoMaterno || ""}`.trim()
    : "";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients.slice(0, max);
    return clients
      .filter((c) =>
        `${c.nombre} ${c.apellidoPaterno || ""} ${c.apellidoMaterno || ""}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, max);
  }, [clients, query, max]);

  // reset highlight when filtered list changes
  useEffect(()=>{ setHighlight(0); }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const commitSelection = (id: string, label: string) => {
    onChange(id);
    setQuery(label);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && ["ArrowDown","ArrowUp","Enter"].includes(e.key)) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => (h + 1) % Math.max(filtered.length, 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => (h - 1 + Math.max(filtered.length,1)) % Math.max(filtered.length,1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[highlight];
      if (item) {
        const full = `${item.nombre} ${item.apellidoPaterno || ""} ${item.apellidoMaterno || ""}`.trim();
        commitSelection(item.id, full);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  useEffect(()=>{
    if(!listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-index='${highlight}']`);
    if (el) {
      const parent = listRef.current;
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (top < parent.scrollTop) parent.scrollTop = top;
      else if (bottom > parent.scrollTop + parent.clientHeight) parent.scrollTop = bottom - parent.clientHeight;
    }
  }, [highlight]);

  return (
    <div ref={ref} className="relative">
      <Input
        placeholder={placeholder}
        value={open ? query : display || query}
        onFocus={() => {
          setOpen(true);
          setQuery(display);
        }}
        onChange={(e) => {
          setQuery(e.currentTarget.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        autoFocus={autoFocus}
        className="pr-8"
        role="combobox"
        aria-expanded={open}
        aria-controls="client-quick-select-list"
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[highlight] ? `cqs-${filtered[highlight].id}` : undefined}
      />
      {selected && !open && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            setQuery("");
            setOpen(true);
          }}
          className="absolute right-1 top-1 text-neutral-400 hover:text-neutral-600 text-xs px-1"
          aria-label="Limpiar"
        >
          ×
        </button>
      )}
      {open && (
        <div
          ref={listRef}
          id="client-quick-select-list"
          role="listbox"
          className="absolute z-30 mt-1 w-full bg-white border rounded-md shadow-lg max-h-64 overflow-auto text-sm"
        >
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-neutral-500 text-xs">Sin coincidencias</div>
          )}
          {filtered.map((c, idx) => {
            const full = `${c.nombre} ${c.apellidoPaterno || ""} ${c.apellidoMaterno || ""}`.trim();
            return (
              <button
                key={c.id}
                type="button"
                data-index={idx}
                id={`cqs-${c.id}`}
                role="option"
                aria-selected={c.id === value || idx === highlight}
                onMouseEnter={()=> setHighlight(idx)}
                onClick={() => commitSelection(c.id, full)}
                className={`block w-full text-left px-3 py-2 hover:bg-neutral-100 focus:bg-neutral-100 outline-none ${
                  idx === highlight ? "bg-neutral-200" : c.id === value ? "bg-neutral-50 font-medium" : ""
                }`}
              >
                {full}
              </button>
            );
          })}
          {clients.length > max && !query && (
            <div className="px-3 py-1 text-[10px] text-neutral-400">
              Mostrando primeros {max}. Escribe para filtrar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
