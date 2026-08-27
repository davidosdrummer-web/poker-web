import { useEffect, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { avatarHue, uid } from '../lib/utils';

/* ---------------- icons ---------------- */

const paths: Record<string, ReactNode> = {
  spade: <path d="M12 2c3.5 4.4 8 7.3 8 11.6a4.4 4.4 0 0 1-6.9 3.7c.3 2.2 1.2 4.1 2.4 5.7H8.5c1.2-1.6 2.1-3.5 2.4-5.7A4.4 4.4 0 0 1 4 13.6C4 9.3 8.5 6.4 12 2z" />,
  heart: <path d="M12 21s-8-4.9-8-11a4.6 4.6 0 0 1 8-3.1A4.6 4.6 0 0 1 20 10c0 6.1-8 11-8 11z" />,
  diamond: <path d="M12 2l6 10-6 10L6 12 12 2z" />,
  club: <path d="M12 2a4 4 0 0 0-3.4 6.1A4 4 0 1 0 9 15.9c.3 2.3 1.2 4.2 2.5 6.1h1c1.3-1.9 2.2-3.8 2.5-6.1a4 4 0 1 0 .4-7.8A4 4 0 0 0 12 2z" />,
  timer: (<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6M12 2v3" /></>),
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.8c2.2.6 3.6 2.3 4 5.2" /></>),
  table: (<><ellipse cx="12" cy="9" rx="9" ry="4.5" /><path d="M3 9v4c0 2.5 4 4.5 9 4.5s9-2 9-4.5V9" /></>),
  blinds: (<><path d="M3 6h18M3 12h18M3 18h12" /><circle cx="19" cy="18" r="2.4" /></>),
  money: (<><rect x="2.5" y="6" width="19" height="12" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M6 9.5h.01M18 14.5h.01" /></>),
  screen: (<><rect x="2.5" y="4" width="19" height="12.5" rx="2" /><path d="M8 21h8M12 16.5V21" /></>),
  settings: (<><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8l1.2 2.6 2.8-.7 1 2.7 2.8.8-.6 2.8 2 2-2 2 .6 2.8-2.8.8-1 2.7-2.8-.7L12 21.2l-1.2-2.6-2.8.7-1-2.7-2.8-.8.6-2.8-2-2 2-2-.6-2.8 2.8-.8 1-2.7 2.8.7L12 2.8z" /></>),
  play: <path d="M7 4.5l12 7.5-12 7.5v-15z" />,
  pause: <path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" />,
  next: <path d="M5 4.5L15 12 5 19.5v-15zM16.5 4h3v16h-3z" />,
  coffee: (<><path d="M4 8h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8z" /><path d="M16 9.5h2a2.5 2.5 0 0 1 0 5h-2M7 2.5c0 1-.8 1.2-.8 2.2M11 2.5c0 1-.8 1.2-.8 2.2" /></>),
  flag: <path d="M5 21V4c4-2.5 8 2.5 14 0v10c-6 2.5-10-2.5-14 0" />,
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (<><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" /><path d="M10 11v5M14 11v5" /></>),
  edit: (<><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19l-4 1z" /><path d="M14.5 6.5l3 3" /></>),
  drag: (<><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></>),
  sound: (<><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /></>),
  search: (<><circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5L21 21" /></>),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  check: <path d="M4.5 12.5l5 5L19.5 7" />,
  up: <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />,
  down: <path d="M12 5v14M5.5 12.5L12 19l6.5-6.5" />,
  download: (<><path d="M12 3v11M7.5 10.5L12 15l4.5-4.5" /><path d="M4 17v3h16v-3" /></>),
  upload: (<><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" /><path d="M4 17v3h16v-3" /></>),
  bell: (<><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></>),
  trophy: (<><path d="M7 4h10v5a5 5 0 0 1-10 0V4z" /><path d="M7 5H4v2a3.5 3.5 0 0 0 3 3.4M17 5h3v2a3.5 3.5 0 0 1-3 3.4M12 14v4M8 21h8M9.5 18h5v3h-5z" /></>),
  crown: <path d="M3 18l1.5-10L9 12l3-7 3 7 4.5-4L21 18H3zM4.5 21h15" />,
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 10.5V17M12 7.2h.01" /></>),
  keyboard: (<><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6" /></>),
  expand: (<><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" /></>),
  swap: (<><path d="M7 4v13M7 17l-3-3M7 17l3-3" transform="translate(0,0)" /><path d="M17 20V7M17 7l-3 3M17 7l3 3" /></>),
  print: (<><path d="M7 8V3h10v5" /><rect x="3" y="8" width="18" height="9" rx="2" /><path d="M7 14h10v7H7z" /></>),
  eye: (<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>),
  bolt: <path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12L13 2z" />,
  hand: <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5v-1a1.5 1.5 0 0 1 3 0V11m0-4.5a1.5 1.5 0 0 1 3 0V13m-9-1l-1.8-1.8a1.6 1.6 0 0 0-2.3 2.2L6 16.5c1.2 2.6 3.2 4.5 6.3 4.5 3.9 0 6.7-2.4 6.7-6.5V13" />,
  refresh: (<><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 3v4h-4" /></>),
  dice: (<><rect x="3.5" y="3.5" width="17" height="17" rx="3.5" /><path d="M8.3 8.3h.01M15.7 8.3h.01M12 12h.01M8.3 15.7h.01M15.7 15.7h.01" /></>),
  link: (<><path d="M10 14a4.5 4.5 0 0 0 6.4.4l3-3a4.5 4.5 0 0 0-6.4-6.4L11.5 6.5" /><path d="M14 10a4.5 4.5 0 0 0-6.4-.4l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5" /></>),
  sun: (<><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></>),
  moon: (<><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></>),
  copy: (<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
};

export function Icon({ name, size = 18, className = '', filled = false }: { name: string; size?: number; className?: string; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0.5 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

/* ---------------- buttons ---------------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'gold' | 'dark' | 'ghost' | 'danger' | 'green';
  size?: 'sm' | 'md' | 'lg';
  icon?: string;
  loading?: boolean;
};

export function Btn({ variant = 'dark', size = 'md', icon, loading = false, className = '', children, disabled, ...rest }: BtnProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-300 active:scale-[0.97] disabled:opacity-35 disabled:pointer-events-none whitespace-nowrap';
  const sizes = { sm: 'text-xs px-3 py-1.5', md: 'text-sm px-4 py-2.5', lg: 'text-base px-6 py-3.5' };
  const variants = {
    gold: 'bg-gold-400 text-felt-950 hover:bg-gold-300 shadow-[0_2px_12px_rgba(242,193,78,0.25)] hover:shadow-[0_4px_20px_rgba(242,193,78,0.4)] hover:scale-[1.02]',
    dark: 'bg-felt-750/80 backdrop-blur text-cream-100 border border-line hover:bg-felt-700 hover:border-felt-600 hover:shadow-lg hover:scale-[1.02]',
    ghost: 'bg-transparent text-cream-300 hover:bg-felt-800/50 hover:text-cream-100 hover:scale-[1.02]',
    danger: 'bg-loss/10 text-loss border border-loss/20 hover:bg-loss/20 hover:shadow-lg hover:shadow-loss/10 hover:scale-[1.02]',
    green: 'bg-win/10 text-win border border-win/20 hover:bg-win/20 hover:shadow-lg hover:shadow-win/10 hover:scale-[1.02]',
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon ? (
        <Icon name={icon} size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} />
      ) : null}
      {children}
    </button>
  );
}

/* ---------------- modal ---------------- */

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}

export function Modal({ title, onClose, children, wide = false, footer }: ModalProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm anim-fade-in" onClick={onClose} />
      <div className={`relative modal-glass anim-slide-up w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[88vh] flex flex-col shadow-2xl rounded-2xl border border-line`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft">
          <h3 className="font-display text-xl tracking-wide text-gold-300">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-cream-500 hover:text-cream-100 hover:bg-felt-750/50 transition-all hover:scale-110 active:scale-95">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-3.5 border-t border-line-soft flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- form bits ---------------- */

export function Field({ label, children, className = '' }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[11px] font-bold uppercase tracking-wider text-cream-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 group disabled:opacity-40 text-left"
    >
      <span className={`relative w-10 h-[22px] rounded-full transition-colors shrink-0 ${checked ? 'bg-gold-500' : 'bg-felt-700'}`}>
        <span className={`absolute top-[3px] w-4 h-4 rounded-full bg-cream-100 transition-all ${checked ? 'left-[21px]' : 'left-[3px]'}`} />
      </span>
      <span className="text-sm text-cream-300 group-hover:text-cream-100 transition-colors">{label}</span>
    </button>
  );
}

/* ---------------- badges ---------------- */

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gold' | 'green' | 'red' | 'info' }) {
  const tones = {
    neutral: 'badge bg-felt-750/50 text-cream-300 border-line',
    gold: 'badge-gold',
    green: 'badge-green',
    red: 'badge-red',
    info: 'badge bg-info/10 text-info border-info/20',
  };
  return <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${tones[tone]}`}>{children}</span>;
}

/* ---------------- toasts ---------------- */

interface Toast {
  id: string;
  text: string;
  tone: 'ok' | 'warn' | 'err';
}

let pushToast: ((t: Toast) => void) | null = null;

export function toast(text: string, tone: Toast['tone'] = 'ok') {
  pushToast?.({ id: uid(), text, tone });
}

export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});
  useEffect(() => {
    pushToast = (t) => {
      setItems((cur) => [...cur.slice(-3), t]);
      timers.current[t.id] = window.setTimeout(() => {
        setItems((cur) => cur.filter((x) => x.id !== t.id));
      }, 3400);
    };
    const saved = timers.current;
    return () => {
      pushToast = null;
      Object.values(saved).forEach(clearTimeout);
    };
  }, []);
  return (
    <div className="fixed bottom-6 right-6 z-[70] flex flex-col gap-3 no-print">
      {items.map((t) => (
        <div
          key={t.id}
          className={`anim-slide-in-right px-5 py-3.5 rounded-xl border text-sm font-semibold shadow-2xl shadow-black/50 flex items-center gap-3 backdrop-blur-sm ${
            t.tone === 'ok' ? 'bg-felt-800/90 border-win/30 text-win' : t.tone === 'warn' ? 'bg-felt-800/90 border-gold-400/30 text-gold-300' : 'bg-felt-800/90 border-loss/30 text-loss'
          }`}
        >
          <Icon name={t.tone === 'ok' ? 'check' : 'info'} size={18} />
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ---------------- misc ---------------- */

export function SpadeMark({ size = 34, accent = '#f2c14e', className = '' }: { size?: number; accent?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <rect width="64" height="64" rx="13" fill="#1020161" opacity="0" />
      <rect x="1.5" y="1.5" width="61" height="61" rx="12.5" fill="rgba(242,193,78,0.06)" stroke={accent} strokeOpacity="0.45" strokeWidth="1.6" />
      <path d="M32 10c6.5 8.4 15 13.9 15 22.3a8.5 8.5 0 0 1-13.2 7.1c.5 4.3 2.2 8 4.7 10.8H25.5c2.5-2.8 4.2-6.5 4.7-10.8A8.5 8.5 0 0 1 17 32.3C17 23.9 25.5 18.4 32 10z" fill={accent} />
    </svg>
  );
}

export function KeyCap({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-md bg-felt-750 border border-line border-b-2 text-[11px] font-bold text-gold-300">
      {children}
    </kbd>
  );
}

export function EmptyState({ icon = 'info', text }: { icon?: string; text: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-cream-500">
      <Icon name={icon} size={34} className="opacity-40" />
      <div className="text-sm">{text}</div>
    </div>
  );
}

export function Avatar({ name, color, avatarData, size = 36, className = '' }: { name: string; color: string | null; avatarData?: string | null; size?: number | string; className?: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '♠';
  const hue = avatarHue(name);
  const bg = color ?? `hsl(${hue} 42% 32%)`;
  const ring = color ?? `hsl(${hue} 55% 52%)`;
  const isStr = typeof size === 'string';
  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center font-display text-cream-100 select-none overflow-hidden avatar-ring ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: isStr ? `calc(${size} * 0.42)` : (size as number) * 0.4,
        background: `linear-gradient(145deg, ${bg}, rgba(10,18,13,0.9))`,
        boxShadow: isStr
          ? `0 0 0 2px ${ring}44, 0 8px 24px rgba(0,0,0,0.3)`
          : `0 0 0 1.5px ${ring}44, 0 8px 24px rgba(0,0,0,0.3), inset 0 -${(size as number) * 0.12}px ${(size as number) * 0.2}px rgba(0,0,0,0.45)`,
        letterSpacing: '0.03em',
      }}
    >
      {avatarData ? <img src={avatarData} alt="" className="w-full h-full object-cover" /> : initials}
    </div>
  );
}

/** логотип клуба: загруженное изображение либо встроенная пика */
export function ClubLogo({ logo, size = 34, accent = '#f2c14e', className = '' }: { logo?: string | null; size?: number; accent?: string; className?: string }) {
  if (logo) {
    return (
      <img
        src={logo}
        alt="logo"
        className={`shrink-0 object-contain rounded-xl ${className}`}
        style={{ width: size, height: size, background: 'rgba(242,193,78,0.05)', boxShadow: `inset 0 0 0 1.5px ${accent}55` }}
      />
    );
  }
  return <SpadeMark size={size} accent={accent} className={className} />;
}