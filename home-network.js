/**
 * home-network.js —— Surge 规则脚本（type=rule）
 *
 * 用途：判断「当前不在家」且「本次请求的目标是家里网段」，
 *       命中后由规则行指定的策略处理（现在指向 🏠 家庭 → WireGuard）。
 *
 * 规则行写法（第三个字段是策略，requires-resolve 才会填充 dnsResult）：
 *   SCRIPT,home-network,🏠 家庭,requires-resolve
 *
 * 相比旧版的改进：
 *   1. 同时识别 5G / 2.4G 两个家庭 SSID（旧版只认 iK_2502_5G）；
 *   2. 增加 IoT 网段 192.168.5.x 的匹配（旧版只有 192.168.0）；
 *   3. 用 /^192\.168\.0\./ 前缀正则替代 includes()，避免 10.192.168.0.x 之类误判；
 *   4. 更稳健的容错：$network / $request / dnsResult 缺失时一律 matched:false；
 *   5. 网关兜底：除 Wi-Fi SSID 外，默认网关是家里网关（0.1 / 5.1）也视为在家，
 *      这样连 IoT 段 Wi-Fi 或未列出的 SSID 时也不会把家庭流量绕进隧道。
 *
 * 注意：已知边界情况——若外部 Wi-Fi 也用 192.168.0.0/24，iOS 会把它当作 on-link，
 *       此时无论判定"在家"还是"在外"，访问 192.168.0.x 都走不通（Surge 层面无解）。
 */
(() => {
  // 家里网段（与 RB5009 的 LAN / IoT VLAN 对应）
  const HOME_SUBNETS = [
    /^192\.168\.0\./,
    /^192\.168\.5\./,
  ];

  // 家里 Wi-Fi 的 SSID（按你的实际 SSID 增删）
  const HOME_SSIDS = [
    "iK_2502_5G",
    "iK_2502_2.4G",
  ];

  // 家里的默认网关（有线 / 未识别 SSID 时兜底）
  const HOME_GATEWAYS = [
    "192.168.0.1",
    "192.168.5.1",
  ];

  const network = $network || {};
  const wifi = network.wifi || {};
  const v4 = network.v4 || {};

  const ssid = wifi.ssid;            // 未连 Wi-Fi 时为 null / undefined
  const router = v4.primaryRouter;   // 当前默认网关，蜂窝下可能为 undefined

  const isHomeWifi =
    typeof ssid === "string" && HOME_SSIDS.indexOf(ssid) !== -1;
  const isHomeGateway =
    typeof router === "string" && HOME_GATEWAYS.indexOf(router) !== -1;
  const isHome = isHomeWifi || isHomeGateway;

  const dnsResult = ($request && $request.dnsResult) || null;

  // 在家：不需要隧道；没有解析结果：无从判断
  if (!dnsResult || isHome) {
    $done({ matched: false });
    return;
  }

  const addresses = []
    .concat(dnsResult.v4Addresses || [])
    .concat(dnsResult.v6Addresses || []); // 目前只用到 v4，保留扩展

  const hit = addresses.some((addr) =>
    HOME_SUBNETS.some((re) => re.test(String(addr)))
  );

  $done({ matched: hit });
})();
