import {
  Baby,
  BookOpen,
  Briefcase,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  Ellipsis,
  Fuel,
  Gift,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  PartyPopper,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Scissors,
  Flower2,
  Heart,
  Stethoscope,
  GraduationCap,
  Bike,
  Bus,
  Music,
  Gamepad2,
  Wifi,
  Droplets,
  HandCoins,
  Church,
  Palette,
  Smartphone,
  TrendingUp,
  Tv,
  UtensilsCrossed,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AccountType } from "../lib/db";

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  utensils: UtensilsCrossed,
  cart: ShoppingCart,
  home: House,
  bolt: Zap,
  car: Car,
  fuel: Fuel,
  heart: HeartPulse,
  book: BookOpen,
  party: PartyPopper,
  bag: ShoppingBag,
  tv: Tv,
  paw: PawPrint,
  coffee: Coffee,
  plane: Plane,
  shirt: Shirt,
  phone: Smartphone,
  dumbbell: Dumbbell,
  baby: Baby,
  wrench: Wrench,
  receipt: Receipt,
  briefcase: Briefcase,
  laptop: Laptop,
  trending: TrendingUp,
  gift: Gift,
  piggy: PiggyBank,
  beauty: Sparkles,
  scissors: Scissors,
  flower: Flower2,
  care: Heart,
  medical: Stethoscope,
  education: GraduationCap,
  bike: Bike,
  bus: Bus,
  music: Music,
  games: Gamepad2,
  wifi: Wifi,
  water: Droplets,
  donation: HandCoins,
  church: Church,
  art: Palette,
  more: Ellipsis,
};

export const CATEGORY_ICON_LABELS: Record<string, string> = {
  utensils: "Alimentação", cart: "Mercado", home: "Moradia", bolt: "Energia",
  car: "Carro", fuel: "Combustível", heart: "Saúde", book: "Livros", party: "Festas",
  bag: "Compras", tv: "Televisão", paw: "Animais", coffee: "Café", plane: "Viagens",
  shirt: "Roupas", phone: "Celular", dumbbell: "Academia", baby: "Bebê",
  wrench: "Manutenção", receipt: "Contas", briefcase: "Trabalho", laptop: "Tecnologia",
  trending: "Investimentos", gift: "Presentes", piggy: "Poupança", more: "Outros",
  beauty: "Beleza", scissors: "Cabelo e salão", flower: "Bem-estar", care: "Cuidados pessoais",
  medical: "Consultas médicas", education: "Educação", bike: "Bicicleta", bus: "Transporte público",
  music: "Música", games: "Jogos", wifi: "Internet", water: "Água", donation: "Doações",
  church: "Religião", art: "Arte",
};

export const PALETTE = [
  "#FF8A1F",
  "#E8590C",
  "#F59F00",
  "#2F9444",
  "#5C940D",
  "#0C8599",
  "#1C7ED6",
  "#5F3DC4",
  "#7048E8",
  "#C2255C",
  "#D6336C",
  "#8B5E3C",
  "#A0522D",
  "#868E96",
  "#212529",
  "#E03131",
  "#1098AD",
  "#9C36B5",
];

export const ACCOUNT_TYPES: Record<AccountType, { label: string; icon: LucideIcon }> = {
  checking: { label: "Conta corrente", icon: Landmark },
  savings: { label: "Poupança", icon: PiggyBank },
  wallet: { label: "Carteira", icon: Wallet },
  credit: { label: "Cartão de crédito", icon: CreditCard },
  investment: { label: "Investimentos", icon: TrendingUp },
};

/** Icon on a soft tint of its own color — keeps colorful categories calm. */
export function ColorIcon({
  icon: Icon,
  color,
  size = "md",
}: {
  icon: LucideIcon;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const box = { sm: "size-8 rounded-xl", md: "size-10 rounded-2xl", lg: "size-12 rounded-2xl" }[size];
  const glyph = { sm: 16, md: 19, lg: 22 }[size];
  return (
    <span className={`${box} grid shrink-0 place-items-center`} style={{ backgroundColor: `${color}1F`, color }} aria-hidden>
      <Icon size={glyph} strokeWidth={2.1} />
    </span>
  );
}

export function categoryIcon(name: string | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name]) || Ellipsis;
}
