import { ReactNode } from "react";

export default function AuthLayout({
  title, subtitle, children, footer,
}: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-lg font-bold tracking-tight text-sea">Send later</p>
        <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-line sm:p-8">
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mb-6 mt-1 text-sm text-mute">{subtitle}</p>}
          {children}
        </div>
        {footer && <p className="mt-5 text-center text-sm text-mute">{footer}</p>}
      </div>
    </div>
  );
}

export const fieldClass =
  "w-full rounded-md border border-line bg-white px-3 py-2 text-sm placeholder:text-mute/60 focus:border-sea";
export const buttonClass =
  "w-full rounded-md bg-sea px-4 py-2.5 text-sm font-semibold text-white hover:bg-sea-dark disabled:opacity-60";
