import clsx from 'clsx';
import {
  ArrowLeftRight, Baby, Banknote, Bike, BookOpen, Briefcase, Bus, Car, Coffee, Coins, Cookie, CreditCard,
  Dumbbell, Fuel, Gamepad2, Gift, GraduationCap, HeartPulse, House, Lightbulb, Package, PawPrint, Pill,
  Plane, Receipt, Scissors, Shirt, ShoppingBag, ShoppingCart, Smartphone, Tag, TrendingUp, Tv,
  UtensilsCrossed, Wallet, Wifi, Wrench, type LucideIcon,
} from 'lucide-react';

// Icons offered for categories (imported one by one so the bundle stays small)
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  House, UtensilsCrossed, ShoppingCart, Car, ShoppingBag, Smartphone, Cookie, HeartPulse, TrendingUp,
  CreditCard, Package, Briefcase, Coins, Wallet, Banknote, Receipt, Coffee, Fuel, Bus, Bike, Plane,
  Wifi, Tv, Lightbulb, Wrench, Shirt, Scissors, Pill, Dumbbell, GraduationCap, BookOpen, Baby,
  PawPrint, Gift, Gamepad2, Tag,
};

export const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b', '#94a3b8',
];

export function CategoryIcon({ icon, color, size = 'md', transfer }: {
  icon?: string | null; color?: string | null; size?: 'sm' | 'md' | 'lg'; transfer?: boolean;
}) {
  const Icon = transfer ? ArrowLeftRight : CATEGORY_ICONS[icon ?? ''] ?? Tag;
  const c = transfer ? '#6366f1' : color ?? '#94a3b8';
  return (
    <span
      className={clsx('grid shrink-0 place-items-center rounded-xl',
        size === 'sm' && 'h-8 w-8', size === 'md' && 'h-10 w-10', size === 'lg' && 'h-12 w-12')}
      style={{ backgroundColor: `${c}1f`, color: c }}
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
    </span>
  );
}
