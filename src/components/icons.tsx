import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (p: P) => ({
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const IconFeed = (p: P) => (
  <svg {...base(p)}><path d="M4 5h16M4 10h10M4 15h16M4 20h10" /></svg>
);
export const IconPeople = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="8" r="3.2" /><path d="M2.8 20c.4-3.4 3-5.4 6.2-5.4s5.8 2 6.2 5.4" /><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18.2 14.8c1.8.7 3 2.4 3.2 5.2" /></svg>
);
export const IconStar = ({ filled, ...p }: P & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? "currentColor" : "none"}><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5Z" /></svg>
);
export const IconBell = (p: P) => (
  <svg {...base(p)}><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9Z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
);
export const IconUser = (p: P) => (
  <svg {...base(p)}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.6-3.8 3.4-6 7-6s6.4 2.2 7 6" /></svg>
);
export const IconShield = (p: P) => (
  <svg {...base(p)}><path d="M12 3 5 6v5.5c0 4.2 2.8 7.6 7 9 4.2-1.4 7-4.8 7-9V6l-7-3Z" /><path d="m9 12 2.2 2.2L15 10.5" /></svg>
);
export const IconSearch = (p: P) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>
);
export const IconFilter = (p: P) => (
  <svg {...base(p)}><path d="M4 6h16M7 12h10M10 18h4" /></svg>
);
export const IconExternal = (p: P) => (
  <svg {...base(p)} width={14} height={14}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
);
export const IconMail = (p: P) => (
  <svg {...base(p)} width={16} height={16}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>
);
export const IconPhone = (p: P) => (
  <svg {...base(p)} width={16} height={16}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>
);
export const IconPin = (p: P) => (
  <svg {...base(p)} width={16} height={16}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const IconX = (p: P) => (
  <svg {...base(p)} width={14} height={14}><path d="m6 6 12 12M18 6 6 18" /></svg>
);
export const IconRobot = (p: P) => (
  <svg {...base(p)}><rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 8V4.5M9 13.5v1M15 13.5v1M2 13v2M22 13v2" /></svg>
);
export const IconCheck = (p: P) => (
  <svg {...base(p)} width={16} height={16}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
);
export const IconLogo = (p: P) => (
  <svg viewBox="0 0 32 32" width={28} height={28} aria-hidden {...p}>
    <rect width="32" height="32" rx="9" fill="var(--brand)" />
    <path d="M9 21.5h14M10.5 21.5V14m5.5 7.5V11m5.5 10.5V14M8 12l8-4.5 8 4.5" stroke="var(--brand-ink)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="25.5" cy="7" r="2.6" fill="var(--gold)" />
  </svg>
);
