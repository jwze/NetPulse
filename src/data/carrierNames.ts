/**
 * 运营商与机房的英文名 → 中文。数据库只给英文，界面不写解释，
 * 所以在这里把常见的那几家翻过来，没命中的保留原文。
 * 顺序有意义：先匹配到的先生效，把「中国电信」放在「电信」类通配之前。
 */
export const CARRIER_CN: { match: RegExp; name: string }[] = [
  { match: /chinanet|china\s*telecom|chinatelecom/i, name: '中国电信' },
  { match: /china\s*unicom|chinaunicom|cnc\s*group/i, name: '中国联通' },
  { match: /china\s*mobile|chinamobile|cmnet/i, name: '中国移动' },
  { match: /china\s*education|cer?net\b/i, name: '中国教育网' },
  { match: /china\s*broadcast|china\s*cable|radio\s*&\s*tv/i, name: '中国广电' },
  { match: /alibaba|aliyun|ali\s*cloud/i, name: '阿里云' },
  { match: /tencent|aceville/i, name: '腾讯云' },
  { match: /huawei|hua\s*wei/i, name: '华为云' },
  { match: /baidu/i, name: '百度云' },
  { match: /kingsoft|jinshan/i, name: '金山云' },
  { match: /ucloud/i, name: 'UCloud' },
  { match: /cloudflare/i, name: 'Cloudflare' },
  { match: /amazon|aws/i, name: 'AWS' },
  { match: /google/i, name: 'Google' },
  { match: /microsoft|azure/i, name: 'Azure' },
  { match: /digitalocean/i, name: 'DigitalOcean' },
  { match: /vultr|choopa|constant company/i, name: 'Vultr' },
  { match: /linode|akamai/i, name: 'Akamai' },
  { match: /\bovh\b/i, name: 'OVH' },
  { match: /hetzner/i, name: 'Hetzner' },
  { match: /oracle/i, name: 'Oracle' },
  { match: /leaseweb/i, name: 'Leaseweb' },
]
