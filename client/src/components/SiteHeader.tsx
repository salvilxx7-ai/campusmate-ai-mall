import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BarChart3, BookOpen, Bot, FileText, LayoutDashboard, LogOut, Menu, PackageCheck, Search, ShieldCheck, Tag, UserRound } from "lucide-react";
import { Link, useLocation } from "wouter";

const navItems = [
  { href: "/", label: "发现好物", icon: Search },
  { href: "/goods", label: "全部商品", icon: BookOpen },
  { href: "/orders", label: "我的订单", icon: PackageCheck },
  { href: "/assistant", label: "AI 客服", icon: Bot },
  { href: "/profile", label: "个人中心", icon: UserRound },
  { href: "/profile/listings", label: "发布管理", icon: Tag },
  { href: "/project", label: "服务说明", icon: FileText },
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
            <><Link href="/admin" className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${location.startsWith("/admin") ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"}`}><LayoutDashboard className="size-3.5" aria-hidden="true" /> 管理台</Link><Link href="/evaluation" className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${location.startsWith("/evaluation") ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"}`}><BarChart3 className="size-3.5" aria-hidden="true" /> 质量监控</Link></>
          ) : null}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="outline" className="size-9 rounded-full md:hidden" aria-label="打开导航菜单">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(86vw,22rem)] p-0">
              <SheetHeader className="border-b border-border p-6 pr-12">
                <SheetTitle className="font-display text-2xl">CampusMate</SheetTitle>
                <SheetDescription>商城、模拟订单与有据可查的 AI 客服。</SheetDescription>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4" aria-label="移动端主导航">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const active = item.href === "/" ? location === "/" : location.startsWith(item.href);
                  return <SheetClose key={item.href} asChild><Link href={item.href} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"}`}><Icon className="size-4" />{item.label}</Link></SheetClose>;
                })}
                {user?.role === "admin" ? <><SheetClose asChild><Link href="/admin" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/70 hover:text-foreground"><LayoutDashboard className="size-4" />管理台</Link></SheetClose><SheetClose asChild><Link href="/evaluation" className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/70 hover:text-foreground"><BarChart3 className="size-4" />质量监控</Link></SheetClose></> : null}
              </nav>
              <SheetFooter className="border-t border-border p-4">
                {!isAuthenticated ? <div className="grid w-full gap-2"><SheetClose asChild><Link href="/login" className="inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">普通用户注册 / 登录</Link></SheetClose><SheetClose asChild><Link href="/admin" className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground">管理员登录</Link></SheetClose></div> : <p className="px-2 text-sm text-muted-foreground">当前登录：{user?.name ?? "校园用户"}</p>}
              </SheetFooter>
            </SheetContent>
          </Sheet>
          {loading ? <span className="h-9 w-20 animate-pulse rounded-full bg-secondary" /> : null}
          {!loading && !isAuthenticated ? <><Button size="sm" variant="outline" asChild className="hidden rounded-full px-3 lg:inline-flex"><Link href="/admin">管理员登录</Link></Button><Button size="sm" onClick={() => startLogin({ returnTo: "/profile" })} className="rounded-full px-4">用户注册 / 登录</Button></> : null}
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
