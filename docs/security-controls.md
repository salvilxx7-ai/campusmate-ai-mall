# CampusMate 安全控制说明

## 订单访问

订单详情请求必须携带当前服务端会话；服务端只在 `order.userId === ctx.user.id` 或当前用户拥有 `admin` 角色时返回订单。普通用户以其他订单 ID 查询时，服务端返回拒绝信息，并追加一条 `auditLogs` 记录，原订单数据不会进入模型提示词或客户端响应。

订单列表不接受任意用户 ID 参数。`orders.listMine` 只使用服务器认证上下文中的 `ctx.user.id` 执行查询，并为每次列表读取追加 `owner_scoped_list` 审计事件。

## 审计日志

受管数据库采用 TiDB，运行时不支持 MySQL `CREATE TRIGGER`，因此不能用触发器实现行级拒绝。CampusMate 以应用层追加式边界实现：只暴露 `writeAuditLog` 追加函数，`assertAuditMutationAllowed` 会拒绝更新或删除意图，且没有任何审计日志的更新、删除、前端管理或 tRPC 过程。审计记录包括操作者、动作、资源类型、资源 ID、结果、原因和创建时间。若迁移到支持触发器的数据库，应将该策略升级为数据库级更新/删除拒绝触发器。

## 角色与入口

普通用户页面不渲染管理入口；管理员操作仍要经过 `adminProcedure` 的服务端角色校验。隐藏入口从来不是授权手段，真实授权只在服务端执行。
