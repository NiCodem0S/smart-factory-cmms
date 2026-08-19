import { useState, useRef, useEffect, ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption<T = string | null> {
    value: T;
    label: string;
    icon?: ReactNode;
    description?: string;
}

export interface SelectV2Props<T = string | null> {
    value: T;
    onChange: (value: T) => void;
    options: readonly SelectOption<T>[] | SelectOption<T>[];
    placeholder?: string;
    icon?: ReactNode;
    disabled?: boolean;
    headerTitle?: string;
    className?: string;
    buttonClassName?: string;
    menuClassName?: string;
    align?: "left" | "right";
    maxMenuHeight?: string;
}

export default function SelectV2<T = string | null>({
    value,
    onChange,
    options,
    placeholder = "Select...",
    icon,
    disabled = false,
    headerTitle,
    className = "",
    buttonClassName = "",
    menuClassName = "",
    align = "left",
    maxMenuHeight = "max-h-60",
}: SelectV2Props<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    const selectedOption = options.find((opt) => opt.value === value);
    const displayLabel = selectedOption ? selectedOption.label : placeholder;

    const handleSelect = (optionValue: T) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen((prev) => !prev)}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                className={`flex items-center justify-between gap-3 px-4 py-2 rounded-lg border text-sm transition-all shadow-sm cursor-pointer select-none bg-white ${isOpen
                        ? "border-blue-500 ring-2 ring-blue-500/20 text-slate-800"
                        : "border-slate-300 hover:border-slate-400 text-slate-700"
                    } focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed ${buttonClassName}`}
            >
                <div className="flex items-center gap-2 min-w-0">
                    {icon && <span className="shrink-0 flex items-center">{icon}</span>}
                    <span className="truncate max-w-[200px] font-normal">{displayLabel}</span>
                </div>
                <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180 text-blue-500" : ""
                        }`}
                />
            </button>

            {isOpen && (
                <div
                    role="listbox"
                    className={`absolute mt-1.5 min-w-[200px] w-max max-w-xs bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${align === "right" ? "right-0" : "left-0"
                        } ${menuClassName}`}
                >
                    {headerTitle && (
                        <div className="px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                            {headerTitle}
                        </div>
                    )}

                    <div className={`overflow-y-auto ${maxMenuHeight}`}>
                        {options.map((option, index) => {
                            const isSelected = option.value === value;
                            return (
                                <button
                                    key={index}
                                    type="button"
                                    role="option"
                                    aria-selected={isSelected}
                                    onClick={() => handleSelect(option.value)}
                                    className={`w-full flex items-center justify-between gap-3 px-3.5 py-2 text-sm text-left transition-colors cursor-pointer ${isSelected
                                            ? "bg-blue-50 text-blue-700 font-medium"
                                            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        {option.icon && (
                                            <span className={`shrink-0 ${isSelected ? "text-blue-600" : "text-slate-400"}`}>
                                                {option.icon}
                                            </span>
                                        )}
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate">{option.label}</span>
                                            {option.description && (
                                                <span className="text-[11px] text-slate-400 truncate">
                                                    {option.description}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <Check className="w-4 h-4 text-blue-600 shrink-0" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
