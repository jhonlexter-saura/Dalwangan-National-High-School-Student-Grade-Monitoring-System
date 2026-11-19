import { useEffect, useRef } from "react";

/**
 * Modern Segmented Code / OTP / PIN Input Component
 *
 * Provides separate boxes for each digit, with:
 * - Strict numeric filtering (digits 0-9 only)
 * - Automatic jump to next box on type
 * - Backspace jumps back and clears previous box
 * - Left/Right arrow navigation
 * - Clipboard paste handling (pastes all digits into boxes)
 * - Click auto-selection for seamless replacement
 * - Midpoint separator for easy readability (e.g. 4 - 4 split for 8 digits)
 */
export default function CodeInput({
  length = 8,
  value = "",
  onChange,
  disabled = false,
  autoFocus = true,
  hasError = false,
  id = "code-input",
  ariaLabel = "Verification code",
}) {
  const inputRefs = useRef([]);

  // Array of digits matching length
  const digits = Array.from({ length }, (_, i) => (value && value[i]) || "");

  // Autofocus first box on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0] && !disabled) {
      // Short delay to avoid race conditions with modal rendering
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, disabled]);

  const updateValue = (newDigits) => {
    const combined = newDigits.join("").slice(0, length);
    onChange(combined);
  };

  const handleInputChange = (e, index) => {
    const rawVal = e.target.value;
    // Keep strictly numeric digits
    const cleaned = rawVal.replace(/\D/g, "");

    if (!cleaned) {
      // User erased or typed non-numeric character
      const nextDigits = [...digits];
      nextDigits[index] = "";
      updateValue(nextDigits);
      return;
    }

    const nextDigits = [...digits];

    // If multiple characters typed or autofilled
    if (cleaned.length > 1) {
      for (let i = 0; i < cleaned.length && index + i < length; i++) {
        nextDigits[index + i] = cleaned[i];
      }
      updateValue(nextDigits);
      const targetFocus = Math.min(index + cleaned.length, length - 1);
      inputRefs.current[targetFocus]?.focus();
      inputRefs.current[targetFocus]?.select();
      return;
    }

    // Single digit typed
    nextDigits[index] = cleaned[0];
    updateValue(nextDigits);

    // Auto-advance focus to next box
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (!digits[index] && index > 0) {
        // Current box already empty, go back and clear previous
        e.preventDefault();
        const nextDigits = [...digits];
        nextDigits[index - 1] = "";
        updateValue(nextDigits);
        inputRefs.current[index - 1]?.focus();
      } else if (digits[index]) {
        // Clear current box
        e.preventDefault();
        const nextDigits = [...digits];
        nextDigits[index] = "";
        updateValue(nextDigits);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
      inputRefs.current[index - 1]?.select();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
      inputRefs.current[index + 1]?.select();
    } else if (e.key === "Delete") {
      e.preventDefault();
      const nextDigits = [...digits];
      nextDigits[index] = "";
      updateValue(nextDigits);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text") || "";
    const cleanDigits = pastedText.replace(/\D/g, "").slice(0, length);
    if (!cleanDigits) return;

    const nextDigits = [...digits];
    for (let i = 0; i < cleanDigits.length; i++) {
      nextDigits[i] = cleanDigits[i];
    }
    updateValue(nextDigits);

    const targetFocus = Math.min(cleanDigits.length, length - 1);
    inputRefs.current[targetFocus]?.focus();
    inputRefs.current[targetFocus]?.select();
  };

  const handleFocus = (e) => {
    e.target.select();
  };

  // Determine split point for visual separator (e.g. 8 digits -> after 4)
  const splitIndex = length % 2 === 0 ? length / 2 : -1;

  return (
    <div
      className="flex items-center justify-center gap-1.5 sm:gap-2.5 py-2"
      role="group"
      aria-label={ariaLabel}
    >
      {digits.map((digit, index) => {
        const isFilled = Boolean(digit);
        return (
          <div key={index} className="flex items-center">
            <input
              ref={(el) => (inputRefs.current[index] = el)}
              id={`${id}-${index}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={digit}
              disabled={disabled}
              onChange={(e) => handleInputChange(e, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onPaste={handlePaste}
              onFocus={handleFocus}
              aria-label={`Digit ${index + 1} of ${length}`}
              className={`h-11 w-9 rounded-lg border text-center font-mono text-lg font-bold sm:h-13 sm:w-11 sm:rounded-xl sm:text-2xl transition-all outline-none ${
                disabled
                  ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                  : hasError
                  ? "border-red-400 bg-red-50/40 text-red-700 focus:border-red-600 focus:ring-2 focus:ring-red-100"
                  : isFilled
                  ? "border-blue-500 bg-blue-50/20 text-slate-900 shadow-sm focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  : "border-slate-300 bg-white text-slate-900 shadow-sm hover:border-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              }`}
            />
            {splitIndex !== -1 && index === splitIndex - 1 && (
              <span
                className="mx-1 text-slate-400 font-bold select-none text-sm sm:text-base"
                aria-hidden="true"
              >
                –
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
