export type IconName = 'grid' | 'file' | 'users' | 'wallet' | 'chart' | 'settings' | 'help' | 'chevron'

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const common = {
    className,
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (name) {
    case 'grid':
      return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>
    case 'file':
      return <svg {...common}><path d="M13.5 3.5H6.8a1.8 1.8 0 0 0-1.8 1.8v13.4a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8V9z" /><path d="M13.5 3.5V9H19M8.5 13h7M8.5 16.5h7" /></svg>
    case 'users':
      return <svg {...common}><path d="M16 20v-1.7a3.3 3.3 0 0 0-3.3-3.3H7.3A3.3 3.3 0 0 0 4 18.3V20" /><circle cx="10" cy="7.5" r="3.5" /><path d="M16 4.2a3.5 3.5 0 0 1 0 6.6M20 20v-1.7a3.3 3.3 0 0 0-2.5-3.2" /></svg>
    case 'wallet':
      return <svg {...common}><rect x="3" y="5.5" width="18" height="15" rx="2.5" /><path d="M3 9h18M16 14.5h.01M6 5.5V4.8A1.8 1.8 0 0 1 7.8 3h10.7" /><path d="M16 12.5h5v4h-5a2 2 0 0 1 0-4z" /></svg>
    case 'chart':
      return <svg {...common}><path d="M4 19.5h16M6.5 16V11M12 16V5M17.5 16V8" /><circle cx="6.5" cy="9" r="1" /><circle cx="12" cy="3" r="1" /><circle cx="17.5" cy="6" r="1" /></svg>
    case 'settings':
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.8 1.8 0 1 1-2.5 2.5l-.1-.1a1.8 1.8 0 0 0-3 .9v.2a1.8 1.8 0 1 1-3.6 0v-.2a1.8 1.8 0 0 0-3-.9l-.1.1a1.8 1.8 0 1 1-2.5-2.5l.1-.1a1.8 1.8 0 0 0-.9-3H3.7a1.8 1.8 0 1 1 0-3.6h.2a1.8 1.8 0 0 0 .9-3l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1.8 1.8 0 0 0 3-.9v-.2a1.8 1.8 0 1 1 3.6 0v.2a1.8 1.8 0 0 0 3 .9l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1.8 1.8 0 0 0 .9 3h.2a1.8 1.8 0 1 1 0 3.6h-.2a1.8 1.8 0 0 0-.9 3z" /></svg>
    case 'help':
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M9.7 9a2.4 2.4 0 1 1 4.2 1.6c-.8.8-1.9 1.2-1.9 2.8M12 17h.01" /></svg>
    case 'chevron':
      return <svg {...common}><path d="m9 18 6-6-6-6" /></svg>
  }
}
