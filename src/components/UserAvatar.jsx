import { useState } from "react";

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
};

function getInitials(name) {
  if (!name) return "?";

  const parts = name.trim().split(/\s+/);

  if (parts.length >= 2) {
    return (
      parts[0][0] + parts[parts.length - 1][0]
    ).toUpperCase();
  }

  return parts[0][0].toUpperCase();
}

export function UserAvatar({
  photoURL,
  name,
  size = "sm",
}) {
  const [broken, setBroken] = useState(false);

  const sizeClass = sizes[size] || sizes.sm;

  if (photoURL && !broken) {
    return (
      <img
        src={photoURL}
        alt={name || "User"}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`${sizeClass} rounded-full object-cover ring-1 ring-slate-200 shrink-0`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} rounded-full bg-slate-200 text-slate-600 font-medium flex items-center justify-center ring-1 ring-slate-200 shrink-0`}
    >
      {getInitials(name)}
    </span>
  );
}

