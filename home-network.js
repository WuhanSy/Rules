/**
 * home-network.js —— Surge 规则脚本（type=rule）
 *
 * 用途：判断「当前不在家」且「本次请求的目标是家里网段」，
 *       命中后由规则行指定的策略处理（指向 🏠 家庭 → WireGuard）。
 *
 * 规则行写法（requires-resolve 才会给域名请求填充 dnsResult）：
 *   SCRIPT,home-network,🏠 家庭,requires-resolve
 *
 * 两种请求都能覆盖：
 *   1. IP 字面量请求（http://192.168.0.3:9080、SMB/SSH 直连 IP）
 *      → 用 $request.hostname 判断（手册：hostname 为域名或 IP 地址）；
 *   2. 域名请求（解析后落在家里网段）
 *      → 用 $request.dnsResult.v4Addresses / v6Addresses 判断。
 *
 * 在家判定：家庭 SSID，或默认网关是家里网关（0.1 / 5.1）→ 不匹配（直连）。
 *
 * 已知边界：外部 Wi-Fi 若也用 192.168.0.0/24，iOS 会当作 on-link，
 *          此时无论判定"在家/在外"都访问不到（Surge 层面无解）。
 */
(() => {
  // 家里网段（RB5009 的 LAN / IoT VLAN）
  const HOME_SUBNETS = [/^192\.168\.0\./, /^192\.168\.5\./];

  // 家里 Wi-Fi 的 SSID（按实际增删）
  const HOME_SSIDS = ["iK_2502_5G", "iK_2502_2.4G"];

  // 家里的默认网关（有线 / 未识别 SSID 时兜底）
  const HOME_GATEWAYS = ["192.168.0.1", "192.168.5.1"];

  const net = $network || {};
  const wifi = net.wifi || {};
  const v4 = net.v4 || {};
  const req = $request || {};

  const ssid = wifi.ssid;
  const router = v4.primaryRouter;

  const isHome =
    (typeof ssid === "string" && HOME_SSIDS.indexOf(ssid) !== -1) ||
    (typeof router === "string" && HOME_GATEWAYS.indexOf(router) !== -1);

  // 在家：不需要隧道
  if (isHome) {
    $done({ matched: false });
    return;
  }

  const inHomeSubnet = (addr) => HOME_SUBNETS.some((re) => re.test(String(addr)));

  // 1) IP 字面量请求：hostname 直接就是 IP
  const hostname = typeof req.hostname === "string" ? req.hostname : "";
  const isIPv4Literal = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  if (isIPv4Literal && inHomeSubnet(hostname)) {
    $done({ matched: true });
    return;
  }

  // 2) 域名请求：看解析结果（需要 requires-resolve）
  const dnsResult = req.dnsResult || null;
  if (!dnsResult) {
    $done({ matched: false });
    return;
  }

  const addresses = []
    .concat(dnsResult.v4Addresses || [])
    .concat(dnsResult.v6Addresses || []);

  $done({ matched: addresses.some(inHomeSubnet) });
})();
