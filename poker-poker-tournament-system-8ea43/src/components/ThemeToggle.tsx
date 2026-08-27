import { useTheme } from '../lib/themeContext';
import { Icon } from './ui';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-lg border border-line-soft hover:bg-felt-800 transition-all duration-300 text-cream-500 hover:text-cream-100 hover:scale-110 active:scale-95"
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
      aria-label="Переключить тему"
    >
      <Icon name={isDark ? 'sun' : 'moon'} size={18} />
    </button>
  );
}