import { useEffect, useId, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './Dropdown.css';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface DropdownProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  label: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  title?: string;
}

export function Dropdown({ value, options, onChange, label, id, disabled = false, className = '', title }: DropdownProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listId = `${triggerId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [pointerEntrance, setPointerEntrance] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [position, setPosition] = useState<CSSProperties>({ left: 0, top: 0, width: 216, maxHeight: 300 });
  const selected = options.find(option => option.value === value) ?? options[0];
  const enabledIndices = options.flatMap((option, index) => option.disabled ? [] : [index]);
  const activeMatch = options.findIndex(option => option.value === activeValue && !option.disabled);
  const selectedMatch = options.findIndex(option => option.value === value && !option.disabled);
  const activeIndex = activeMatch >= 0 ? activeMatch : selectedMatch >= 0 ? selectedMatch : (enabledIndices[0] ?? -1);
  const unavailable = disabled || enabledIndices.length === 0;

  function show(index = selectedMatch >= 0 ? selectedMatch : enabledIndices[0], pointer = false) {
    if (unavailable || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 216), Math.max(1, window.innerWidth - 16));
    const below = Math.max(0, window.innerHeight - rect.bottom - 12);
    const above = Math.max(0, rect.top - 12);
    const height = Math.min(300, options.length * 36 + 10);
    const flipped = below < height && above > below;
    const maxHeight = Math.min(height, flipped ? above : below);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPosition({ left, top: flipped ? rect.top - maxHeight - 4 : rect.bottom + 4, width, maxHeight, transformOrigin: `${left < rect.left ? 'right' : 'left'} ${flipped ? 'bottom' : 'top'}` });
    setActiveValue(options[index]?.value ?? null);
    searchRef.current = { text: '', time: 0 };
    setOpen(true);
    setPointerEntrance(pointer);
  }

  function dismiss() {
    triggerRef.current?.focus();
    setOpen(false);
  }

  function select(index: number) {
    const option = options[index];
    if (!option || option.disabled) return;
    dismiss();
    onChange(option.value);
  }

  function blur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (!rootRef.current?.contains(next) && !listRef.current?.contains(next)) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) setOpen(false);
    };
    const scroll = (event: Event) => { if (!listRef.current?.contains(event.target as Node)) dismiss(); };
    const resize = () => dismiss();
    document.addEventListener('pointerdown', outside);
    document.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', resize);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', resize);
    };
  }, [open]);

  useEffect(() => {
    if (open && unavailable) dismiss();
    else if (open) listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [open, unavailable, activeIndex]);

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Tab') { dismiss(); return; }
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); dismiss(); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(activeIndex); return; }
    let next = activeIndex;
    const enabledIndex = enabledIndices.indexOf(activeIndex);
    if (event.key === 'ArrowDown') next = enabledIndices[(enabledIndex + 1) % enabledIndices.length];
    else if (event.key === 'ArrowUp') next = enabledIndices[(enabledIndex - 1 + enabledIndices.length) % enabledIndices.length];
    else if (event.key === 'Home') next = enabledIndices[0];
    else if (event.key === 'End') next = enabledIndices.at(-1)!;
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const previous = now - searchRef.current.time < 700 ? searchRef.current.text : '';
      const text = previous + event.key.toLocaleLowerCase();
      searchRef.current = { text, time: now };
      const query = [...text].every(char => char === text[0]) ? text[0] : text;
      for (let offset = 1; offset <= options.length; offset++) {
        const index = (activeIndex + offset) % options.length;
        if (!options[index].disabled && options[index].label.toLocaleLowerCase().startsWith(query)) { next = index; break; }
      }
    } else return;
    event.preventDefault();
    setActiveValue(options[next]?.value ?? null);
  }

  return <div ref={rootRef} className={`dropdown ${className}`} onBlur={blur}>
    <button ref={triggerRef} id={triggerId} className="dropdown-trigger" type="button" disabled={unavailable} aria-label={label} aria-describedby={`${triggerId}-value`} title={title} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} onClick={event => open ? dismiss() : show(undefined, event.detail > 0)} onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault(); event.stopPropagation(); show(event.key === 'Home' ? enabledIndices[0] : event.key === 'End' ? enabledIndices.at(-1) : undefined);
      }
    }}>
      {selected?.icon}<span id={`${triggerId}-value`} className="dropdown-name">{selected?.label ?? ''}</span><ChevronDown className="dropdown-chevron" size={14} aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={listRef} id={listId} className={`dropdown-list${pointerEntrance ? ' dropdown-list--entering' : ''}`} role="listbox" aria-label={label} aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} tabIndex={-1} style={position} onKeyDown={keyDown}>
      {options.map((option, index) => <div id={`${listId}-${index}`} key={option.value} role="option" aria-selected={option.value === value} aria-disabled={option.disabled || undefined} className={`dropdown-option ${index === activeIndex ? 'focused' : ''}`} onPointerMove={() => { if (!option.disabled) setActiveValue(option.value); }} onMouseDown={event => event.preventDefault()} onClick={() => select(index)}>
        {option.icon}<span className="dropdown-name">{option.label}</span>{option.value === value && <Check size={15} aria-hidden="true" />}
      </div>)}
    </div>, triggerRef.current?.closest('[role="dialog"]') ?? document.body)}
  </div>;
}
