import * as React from 'react';

export function Logo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect width="32" height="32" rx="8" fill="hsl(var(--primary))"/>
      <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fontSize="16" fill="hsl(var(--primary-foreground))" fontFamily="inherit" fontWeight="600">
        NK
      </text>
    </svg>
  );
}
