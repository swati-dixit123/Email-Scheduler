import { useState } from "react";
import { fieldClass } from "./AuthLayout";

export default function PasswordInput(props: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={props.id} type={show ? "text" : "password"} required value={props.value}
        onChange={(e) => props.onChange(e.target.value)} autoComplete={props.autoComplete}
        placeholder={props.placeholder} maxLength={72} className={`${fieldClass} pr-14`} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}
        className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-mute hover:text-ink">
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
