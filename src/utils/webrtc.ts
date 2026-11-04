/**
 * WebRTC 网络拓扑探测：靠 STUN 拿本机内网地址与 NAT 映射，判断是否处在
 * 双层 NAT / 运营商级 NAT 之后。只与 STUN 服务器交换绑定请求，不建立任何
 * 数据通道，也不向第三方发送内容。
 */

export interface IceCandidateInfo {
  type: 'host' | 'srflx' | 'prflx' | 'relay' | string
  protocol: string
  address: string
  port: number
  relatedAddress: string
  relatedPort: number
  mdns: boolean
}

export interface StunMapping {
  key: string
  label: string
  address: string
  port: number
}

export type NatType = 'open' | 'cone' | 'symmetric' | 'blocked' | 'unsupported' | 'unknown'

export interface NatProbeResult {
  supported: boolean
  natType: NatType
  natLabel: string
  natHint: string
  /** 内网地址（浏览器做了 mDNS 混淆时为空） */
  localIps: string[]
  /** 浏览器把内网地址替换成了 xxx.local */
  mdnsHidden: boolean
  /** IPv6 内网地址 */
  localV6: string[]
  mappings: StunMapping[]
  /** STUN 映射地址与 HTTP 出口是否一致；null 表示缺少对比数据 */
  doubleNat: boolean | null
  doubleNatLabel: string
  doubleNatReason: string
  /** 用于比较的出口协议（IPv4 / IPv6 / 未知） */
  exitProtocol: string
  candidateCount: number
  elapsed: number
}

const STUN_SERVERS = [
  { key: 'miwifi', label: '小米', url: 'stun:stun.miwifi.com:3478' },
  { key: 'qq', label: '腾讯', url: 'stun:stun.qq.com:3478' },
  { key: 'bilibili', label: '哔哩哔哩', url: 'stun:stun.chat.bilibili.com:3478' },
]

function parseCandidates(sdp: string): IceCandidateInfo[] {
  const result: IceCandidateInfo[] = []
  for (const line of sdp.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('a=candidate:')) continue
    const parts = trimmed.slice('a=candidate:'.length).split(/\s+/)
    // foundation component protocol priority address port typ type ...
    const protocol = (parts[2] || '').toLowerCase()
    const address = parts[4] || ''
    const port = Number(parts[5]) || 0
    const type = parts[7] || ''
    if (!address || !type) continue

    let relatedAddress = ''
    let relatedPort = 0
    for (let i = 8; i < parts.length - 1; i += 1) {
      if (parts[i] === 'raddr') relatedAddress = parts[i + 1]
      if (parts[i] === 'rport') relatedPort = Number(parts[i + 1]) || 0
    }

    result.push({
      type,
      protocol,
      address,
      port,
      relatedAddress,
      relatedPort,
      mdns: address.endsWith('.local'),
    })
  }
  return result
}

/** 建一个只带单个 STUN 的 PeerConnection，收完候选就关掉 */
async function gatherFrom(serverUrl: string, timeout = 4000): Promise<IceCandidateInfo[]> {
  if (typeof RTCPeerConnection === 'undefined') return []
  let pc: RTCPeerConnection | null = null
  try {
    pc = new RTCPeerConnection({
      iceServers: [{ urls: serverUrl }],
      iceCandidatePoolSize: 0,
    })
    pc.createDataChannel('probe')

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await new Promise<void>((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        resolve()
      }
      const timer = window.setTimeout(finish, timeout)
      if (!pc) return finish()
      pc.onicegatheringstatechange = () => {
        if (pc?.iceGatheringState === 'complete') finish()
      }
      pc.onicecandidate = (event) => {
        if (!event.candidate) finish()
      }
      if (pc.iceGatheringState === 'complete') finish()
    })

    return parseCandidates(pc.localDescription?.sdp || '')
  } catch {
    return []
  } finally {
    try {
      pc?.close()
    } catch {
      // 关闭失败不影响结果
    }
  }
}

function isIpv6(address: string) {
  return address.includes(':')
}

/**
 * 单独取一次 IPv4 出口。页面本身可能走 IPv6，而 STUN 拿到的永远是 IPv4 映射，
 * 两者不能直接比较，必须用纯 IPv4 出口作为基准。
 */
async function fetchIpv4Exit(timeout = 4000): Promise<string | undefined> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeout)
  try {
    const resp = await fetch('https://v4.ident.me', {
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: ctrl.signal,
    })
    if (!resp.ok) return undefined
    const text = (await resp.text()).trim()
    return /^\d{1,3}(\.\d{1,3}){3}$/.test(text) ? text : undefined
  } catch {
    return undefined
  } finally {
    window.clearTimeout(timer)
  }
}

function classifyNat(
  localIps: string[],
  mappings: StunMapping[],
  hasHost: boolean,
): { type: NatType; label: string; hint: string } {
  if (!hasHost) {
    return { type: 'unsupported', label: '不可用', hint: '当前环境不支持 WebRTC 或处于不安全上下文（需 HTTPS / localhost）' }
  }
  if (!mappings.length) {
    return {
      type: 'blocked',
      label: 'UDP 受限',
      hint: '所有 STUN 都没回应，UDP 出站可能被防火墙或代理拦截，P2P 通话会退化为中继',
    }
  }

  const publicAddresses = new Set(mappings.map(item => item.address))
  const ports = new Set(mappings.map(item => item.port))
  const mapped = mappings[0]

  if (localIps.includes(mapped.address)) {
    return { type: 'open', label: '公网直连', hint: '本机直接持有公网地址，前面没有 NAT' }
  }
  if (publicAddresses.size > 1) {
    return { type: 'symmetric', label: '对称型 / 多出口', hint: '不同 STUN 看到的公网地址不同，通常意味着多出口或负载均衡' }
  }
  if (ports.size > 1) {
    return {
      type: 'symmetric',
      label: '对称型 NAT',
      hint: '每个目的地址分配不同端口，P2P 打洞成功率低，通话更容易走中继',
    }
  }
  return {
    type: 'cone',
    label: '锥形 NAT',
    hint: '映射端口稳定，P2P 打洞成功率高，属于对通话友好的类型',
  }
}

/**
 * @param httpIp 出口 IP（来自 ipwho.is / ipapi.co），用于判断是否存在多层地址转换。
 *               可传 Promise，使其与 STUN 收集并行执行。
 */
export async function probeNat(httpIp?: string | Promise<string | undefined>): Promise<NatProbeResult> {
  const started = performance.now()
  const supported = typeof RTCPeerConnection !== 'undefined'

  if (!supported) {
    return {
      supported: false,
      natType: 'unsupported',
      natLabel: '不可用',
      natHint: '当前浏览器不支持 WebRTC',
      localIps: [],
      mdnsHidden: false,
      localV6: [],
      mappings: [],
      doubleNat: null,
      doubleNatLabel: '未知',
      doubleNatReason: '需要 WebRTC 支持才能判断',
      exitProtocol: '未知',
      candidateCount: 0,
      elapsed: 0,
    }
  }

  const ipTask = Promise.resolve(httpIp).catch(() => undefined)
  const ipv4Task = fetchIpv4Exit()
  const gathered = await Promise.all(
    STUN_SERVERS.map(async (server) => ({
      server,
      candidates: await gatherFrom(server.url),
    })),
  )

  const all = gathered.flatMap(item => item.candidates)
  const hostCandidates = all.filter(item => item.type === 'host')
  const mdnsHidden = hostCandidates.some(item => item.mdns) && !hostCandidates.some(item => !item.mdns)

  const localIps = Array.from(new Set(
    hostCandidates
      .filter(item => !item.mdns && !isIpv6(item.address))
      .map(item => item.address),
  ))
  const localV6 = Array.from(new Set(
    hostCandidates
      .filter(item => !item.mdns && isIpv6(item.address))
      .map(item => item.address),
  ))

  const mappings: StunMapping[] = []
  gathered.forEach(({ server, candidates }) => {
    const srflx = candidates.find(item => item.type === 'srflx' && !isIpv6(item.address))
    if (srflx) mappings.push({ key: server.key, label: server.label, address: srflx.address, port: srflx.port })
  })

  const nat = classifyNat(localIps, mappings, hostCandidates.length > 0)

  // 双层 NAT：本机在私网里，但 STUN 看到的公网地址和 HTTP 出口不是同一个
  let doubleNat: boolean | null = null
  let doubleNatLabel = '未知'
  let doubleNatReason = '缺少出口 IP 或 STUN 映射，暂时无法判断'
  const mappedIp = mappings[0]?.address
  let resolvedHttpIp = await ipTask
  let exitProtocol = resolvedHttpIp ? (isIpv6(resolvedHttpIp) ? 'IPv6' : 'IPv4') : '未知'
  // 页面出口是 IPv6 时，改用纯 IPv4 出口与 STUN 映射比较
  if (!resolvedHttpIp || isIpv6(resolvedHttpIp)) {
    const v4 = await ipv4Task
    if (v4) {
      resolvedHttpIp = v4
      exitProtocol = 'IPv4'
    } else if (resolvedHttpIp && isIpv6(resolvedHttpIp)) {
      resolvedHttpIp = undefined
      exitProtocol = 'IPv6'
    }
  }
  const cgnatHost = localIps.some(ip => /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip))

  if (mappedIp && resolvedHttpIp) {
    if (mappedIp === resolvedHttpIp) {
      doubleNat = false
      doubleNatLabel = '单层 NAT'
      doubleNatReason = cgnatHost
        ? '本机地址属于运营商级 NAT 网段，但 STUN 与 HTTP 出口一致，出口只有一层转换'
        : 'STUN 映射地址与 HTTP 出口一致，路由链路上只有一层地址转换'
    } else {
      doubleNat = true
      doubleNatLabel = cgnatHost ? '运营商级 NAT' : '可能双层 NAT'
      doubleNatReason = cgnatHost
        ? '本机地址落在 100.64/10（运营商级 NAT 网段），公网映射由运营商统一分配'
        : 'STUN 看到的公网地址与 HTTP 出口不同，可能路由器后面还套了一层 NAT 或走了代理'
    }
  } else if (mappedIp && !resolvedHttpIp) {
    doubleNatReason = exitProtocol === 'IPv6'
      ? '当前页面走 IPv6 出口，与 IPv4 的 STUN 映射不是同一条链路，无法比较层数'
      : '没拿到 HTTP 出口 IP，仅能给出 STUN 映射地址'
  } else if (!mappedIp && localIps.length) {
    doubleNatReason = 'STUN 未返回公网映射，可能 UDP 被拦截，无法判断层数'
  }

  return {
    supported: true,
    natType: nat.type,
    natLabel: nat.label,
    natHint: nat.hint,
    localIps,
    mdnsHidden,
    localV6,
    mappings,
    doubleNat,
    doubleNatLabel,
    doubleNatReason,
    exitProtocol,
    candidateCount: all.length,
    elapsed: Number(((performance.now() - started) / 1000).toFixed(1)),
  }
}
