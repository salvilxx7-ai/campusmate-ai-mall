import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { ArrowRight, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "wouter";

export default function Login() {
  const { user, loading } = useAuth();
  const destination = user?.role === "admin" ? "/admin" : "/profile";
  const destinationLabel = user?.role === "admin" ? "进入管理台" : "进入个人中心";

  return <div className="min-h-screen bg-background">
    <SiteHeader />
    <main className="container py-10 sm:py-16">
      <section className="overflow-hidden rounded-[1.75rem] bg-primary px-7 py-10 text-primary-foreground shadow-[0_22px_54px_-32px_rgba(45,33,60,0.85)] sm:px-10">
        <p className="text-xs font-semibold tracking-[0.16em] text-[#d8c8e7]">ACCESS CAMPUSMATE</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold tracking-[-0.06em] sm:text-5xl">选择进入方式，权限仍由服务端决定。</h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-[#eee5f4]">CampusMate 通过 Manus OAuth 完成身份验证，不保存本地密码。首次普通用户授权后会自动创建普通用户档案；管理员权限只能由系统在服务端授予。</p>
      </section>

      {user ? <section className="mt-7 max-w-2xl rounded-[1.5rem] border border-border bg-card p-7">
        <p className="text-xs font-semibold tracking-[0.14em] text-primary">SIGNED IN</p>
        <h2 className="mt-2 font-display text-3xl font-bold">当前已登录为{user.role === "admin" ? "管理员" : "普通用户"}</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{user.name ?? "当前账户"} 已完成身份验证。账号角色由服务端用户记录决定，不能通过此页面切换或提升权限。</p>
        <Button asChild className="mt-7 rounded-xl"><Link href={destination}>{destinationLabel}<ArrowRight className="ml-2 size-4" /></Link></Button>
      </section> : <section className="mt-7 grid gap-5 lg:grid-cols-2">
        <article className="rounded-[1.5rem] border border-border bg-card p-7">
          <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary"><UserRound className="size-5" /></span>
          <p className="mt-6 text-xs font-semibold tracking-[0.14em] text-primary">STUDENT ACCOUNT</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.045em]">普通用户注册 / 登录</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">还没有账号时，请在授权页按平台指引注册；完成首次授权后即可浏览商品、创建模拟订单、查看个人中心与使用客服。</p>
          <Button className="mt-7 rounded-xl" onClick={() => startLogin({ returnTo: "/profile" })} disabled={loading}>注册或登录 <ArrowRight className="ml-2 size-4" /></Button>
        </article>
        <article className="rounded-[1.5rem] border border-primary/25 bg-secondary/30 p-7">
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></span>
          <p className="mt-6 text-xs font-semibold tracking-[0.14em] text-primary">ADMINISTRATOR ACCOUNT</p>
          <h2 className="mt-2 font-display text-3xl font-bold tracking-[-0.045em]">管理员登录</h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">仅供已获管理员角色的专用账号使用。这个入口只决定授权完成后的回跳页面，不能自行把普通用户提升为管理员；所有后台接口仍由 `adminProcedure` 校验。</p>
          <Button variant="outline" className="mt-7 rounded-xl" onClick={() => startLogin({ returnTo: "/admin" })} disabled={loading}><KeyRound className="mr-2 size-4" />管理员授权</Button>
        </article>
      </section>}
      <p className="mt-7 text-sm text-muted-foreground">还未登录时，请从上方选择对应入口。<Link href="/" className="ml-1 font-medium text-primary hover:underline">返回公开商城</Link></p>
    </main>
  </div>;
}
