import React from "react";

function IconBase({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function HomeIcon() {
  return <IconBase><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.8V21h14V9.8" /></IconBase>;
}

export function InboxIcon() {
  return <IconBase><path d="M4 5h16v14H4z" /><path d="M4 13h5l2 3h2l2-3h5" /></IconBase>;
}

export function CheckIcon() {
  return <IconBase><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.4 2.4L15.8 9.5" /></IconBase>;
}

export function CartIcon() {
  return <IconBase><circle cx="9" cy="19" r="1.6" /><circle cx="17" cy="19" r="1.6" /><path d="M4 5h2l2.5 10h9.5l2-7H7.2" /></IconBase>;
}

export function FactoryIcon() {
  return <IconBase><path d="M3 21h18" /><path d="M5 21V10l6 3V9l6 3v9" /><path d="M9 21v-4h6v4" /></IconBase>;
}

export function TruckIcon() {
  return <IconBase><path d="M3 7h11v9H3z" /><path d="M14 10h4l3 3v3h-7z" /><circle cx="7.5" cy="18" r="1.5" /><circle cx="17.5" cy="18" r="1.5" /></IconBase>;
}

export function UsersIcon() {
  return <IconBase><circle cx="9" cy="8" r="3" /><circle cx="16.5" cy="9.5" r="2.5" /><path d="M3.5 19c.9-2.8 3-4 5.5-4s4.6 1.2 5.5 4" /><path d="M13 18c.5-1.7 1.8-2.7 3.9-2.7 1.3 0 2.6.4 3.5 1.6" /></IconBase>;
}

export function BellIcon() {
  return <IconBase><path d="M6 9a6 6 0 1 1 12 0v4l2 2H4l2-2z" /><path d="M10 18a2 2 0 0 0 4 0" /></IconBase>;
}

export function MenuIcon() {
  return <IconBase><path d="M4 7h16M4 12h16M4 17h16" /></IconBase>;
}

export function ChevronDownIcon() {
  return <IconBase><path d="m6 9 6 6 6-6" /></IconBase>;
}

export function ChevronLeftIcon() {
  return <IconBase><path d="m15 18-6-6 6-6" /></IconBase>;
}

export function SearchIcon() {
  return <IconBase><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></IconBase>;
}

export function EyeIcon() {
  return <IconBase><path d="M2.5 12s3.6-6 9.5-6 9.5 6 9.5 6-3.6 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.6" /></IconBase>;
}

export function EditIcon() {
  return <IconBase><path d="M4 20h4l10-10-4-4L4 16z" /><path d="m12.5 7.5 4 4" /></IconBase>;
}

export function TrashIcon() {
  return <IconBase><path d="M4 7h16" /><path d="M9 7V5h6v2" /><path d="M7 7l1 13h8l1-13" /><path d="M10 11v6M14 11v6" /></IconBase>;
}

export function PlusIcon() {
  return <IconBase><path d="M12 5v14M5 12h14" /></IconBase>;
}

export function ClipboardIcon() {
  return <IconBase><rect x="6" y="4" width="12" height="16" rx="2" /><path d="M9 4.5h6" /><path d="M9 10h6M9 14h6" /></IconBase>;
}

export function HourglassIcon() {
  return <IconBase><path d="M7 3h10" /><path d="M7 21h10" /><path d="M8 3c0 4 3 4.5 4 6-1 1.5-4 2-4 6" /><path d="M16 3c0 4-3 4.5-4 6 1 1.5 4 2 4 6" /></IconBase>;
}

export function BoxesIcon() {
  return <IconBase><path d="M3 8 12 3l9 5-9 5-9-5Z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></IconBase>;
}

export function CircleCheckIcon() {
  return <IconBase><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.4 2.4L15.8 9.5" /></IconBase>;
}
