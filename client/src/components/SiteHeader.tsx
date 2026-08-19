import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { BarChart3, BookOpen, Bot, FileText, LayoutDashboard, LogOut, PackageCheck, Search, ShieldCheck, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";

const navItems = [
  { href: "/", label: "发现好物", icon: Search },
  { href: "/goods", label: "全部商品", icon: BookOpen },
  { href: "/orders", label: "我的订单", icon: PackageCheck },
  { href: "/assistant", label: "AI 客服", icon: Bot },
  { href: "/profile", label: "个人中心", icon: UserRound },
  { href: "/project", label: "项目说明", icon: FileText },
];

export function SiteHeader() {
  const [location] = useLocation();
  const { user, isAuthenticated, loading, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/92 backdrop-blur-xl">
      <div className="container flex h-[4.75rem] items-center justify-between gap-4">
        <Link href="/" className="group flex min-w-0 items-center gap-3" aria-label="CampusMate 首页">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-200 group-hover:scale-[1.04]">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 leading-none">
            <strong className="font-display block text-[1.12rem] tracking-[-0.04em] text-foreground">CampusMate</strong>
            <span className="mt-1 block text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">校园二手好物</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="主导航">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
          {user?.role === "admin" ? (
            <><Link href="/admin" className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${location.startsWith("/admin") ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"}`}><LayoutDashboard className="size-3.5" aria-hidden="true" /> 管理台</Link><Link href="/evaluation" className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${location.startsWith("/evaluation") ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"}`}><BarChart3 className="size-3.5" aria-hidden="true" /> 评测</Link></>
          ) : null}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          {loading ? <span className="h-9 w-20 animate-pulse rounded-full bg-secondary" /> : null}
          {!loading && !isAuthenticated ? (
            <Button size="sm" onClick={() => startLogin()} className="rounded-full px-4">
              登录后下单
            </Button>
          ) : null}
          {!loading && isAuthenticated ? (
            <div className="flex items-center gap-2">
              <span className="hidden max-w-28 truncate text-sm font-medium text-foreground sm:block">{user?.name ?? "校园用户"}</span>
              <Button size="icon" variant="outline" className="size-9 rounded-full" onClick={() => void logout()} aria-label="退出登录">
                <LogOut className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
