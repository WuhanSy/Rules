# Rules

个人自用的 **Surge 脚本 / 规则清单** 仓库。
（原 `MyRules` 仓库已合并至此，两边的提交历史均保留。）

## 文件说明

| 文件 | 用途 |
|---|---|
| `home-network.js` | Surge **规则脚本**（`type=rule`）。判断「当前不在家」且「请求目标是家里网段」时命中，交给 `🏠 家庭` 策略（WireGuard 隧道）；在家（家庭 SSID 或默认网关是家里网关）时返回不匹配，走直连。 |
| `21cae1a8b8fb0341603605d5e13d8398.jpg` | 图片资源。 |

## home-network.js 行为

- **在家判定**：Wi-Fi SSID 属于家庭 SSID，**或** 默认网关为 `192.168.0.1` / `192.168.5.1` → 不匹配（`matched:false`）；
- **命中判定**：不在家，且 DNS 解析结果落在 `192.168.0.0/24` 或 `192.168.5.0/24`（用前缀正则匹配，避免 `10.192.168.0.x` 之类误判）；
- **容错**：`$network` / `$request.dnsResult` 缺失时一律返回不匹配。

## Surge 配置示例

```ini
[Script]
home-network = type=rule,script-path=https://raw.githubusercontent.com/WuhanSy/Rules/refs/heads/main/home-network.js,debug=false,engine=jsc,script-update-interval=0

[Rule]
# IP 字面量：不触发 DNS
IP-CIDR,192.168.0.0/24,🏠 家庭,no-resolve
IP-CIDR,192.168.5.0/24,🏠 家庭,no-resolve
# 域名形式：先解析再判断
SCRIPT,home-network,🏠 家庭,requires-resolve
```

`🏠 家庭` 策略组（在家直连、在外走 WireGuard）：

```ini
🏠 家庭 = subnet, default = HomeWG, "SSID:<家里5G的SSID>" = DIRECT, "SSID:<家里2.4G的SSID>" = DIRECT, "ROUTER:192.168.0.1" = DIRECT
```

WireGuard 阶段（peer 侧）：

```ini
HomeWG = wireguard, section-name=HomeWG

[WireGuard HomeWG]
private-key = <客户端私钥>
self-ip = 10.99.99.2
mtu = 1412
peer = (public-key = <服务端公钥>, allowed-ips = "10.99.99.0/24, 192.168.0.0/24, 192.168.5.0/24", endpoint = <DDNS域名>:51820, keepalive = 25)
```

## 维护说明

- `script-update-interval=0`：**不会自动更新**脚本；改完仓库后需在 Surge 内重新加载配置。
- 已知边界：外部 Wi-Fi 若也用 `192.168.0.0/24`，iOS 会把它当作 on-link，此时访问家里网段会失败（Surge 层面无解）。
- 历史变更：
  - 2026-11-17：由 `MyRules` 合并而来（历史保留）；删除不再使用的 `auto-policy.js`、`Proxy`；
    删除每周生成 mosdns 规则的 workflow 与 `rules-data` 分支（该功能已停用）。
