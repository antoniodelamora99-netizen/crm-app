"use client";
import * as React from "react";

type SwitchProps = React.InputHTMLAttributes<HTMLInputElement> & {
  checked?: boolean;
};

export function Switch({ checked, disabled, className, ...props }: SwitchProps) {
  return (
    <label className={`inline-flex items-center cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}>
      <input
        type="checkbox"
        className="sr-only peer"
        checked={!!checked}
        disabled={disabled}
        {...props}
      />
      <div className={`w-10 h-6 bg-gray-300 peer-checked:bg-emerald-500 rounded-full relative transition-colors`}> 
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform peer-checked:translate-x-4`}></div>
      </div>
    </label>
  );
}
