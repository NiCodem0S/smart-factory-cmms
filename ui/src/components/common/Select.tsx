import { useState, useRef, useEffect, ReactNode } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption<T = string | null> {
    value: T;
    label: string;
    icon?: ReactNode;
    description?: string;
}

export interface SelectProps<T = string | null> {
    value: T;
    onChange: (value: T) => void;
    options: SelectOption<T>[];
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

export default function Select<T = string | null>({
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
    align = "right",
    maxMenuHeight = "max-h-60",
}: SelectProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Zamykanie przy kliknięciu poza komponentem
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
            {/* Przycisk wyzwalający */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen((prev) => !prev)}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                className={`flex gap-2 bg-slate-50 hover:bg-slate-100/90 transition-all border border-slate-200 px-5 py-1.5 rounded-lg shadow-s text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none ${buttonClassName}`}
            >
                {icon && <span className="shrink-0 flex items-center">{icon}</span>}
                <span className="truncate max-w-[180px]">{displayLabel}</span>
                <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""
                        }`}
                />
            </button>

            {/* Rozwijane menu opcji */}
            {isOpen && (
                <div
                    role="listbox"
                    className={`absolute mt-1.5 min-w-[210px] w-max max-w-xs bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 ${align === "right" ? "right-0" : "left-0"
                        } ${menuClassName}`}
                >
                    {headerTitle && (
                        <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
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
                                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-xs text-left transition-colors cursor-pointer ${isSelected
                                        ? "bg-slate-100 text-slate-900 font-semibold"
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        {option.icon && (
                                            <span className="shrink-0 text-slate-400">
                                                {option.icon}
                                            </span>
                                        )}
                                        <div className="flex flex-col min-w-0">
                                            <span className="truncate">{option.label}</span>
                                            {option.description && (
                                                <span className="text-[10px] text-slate-400 truncate">
                                                    {option.description}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <Check className="w-3.5 h-3.5 text-slate-700 shrink-0" />
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
