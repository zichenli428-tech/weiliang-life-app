/**
 * 天气服务层
 * 接入和风天气（QWeather）API，通过浏览器定位获取实时天气
 * API Key 和专属 Host 通过环境变量配置，不硬编码
 *
 * ─── 和风天气 API 接入说明 ───
 * 和风天气 2026 年起停用公共域名 devapi.qweather.com，
 * 改为每个账号专属的 API Host（形如 xxx.re.qweatherapi.com），
 * 认证方式从 URL 查询参数 ?key=xxx 改为请求头 X-QW-Api-Key: xxx。
 *
 *   请求示例：
 *   GET https://{专属API_HOST}/v7/weather/now?location={经度},{纬度}
 *   Headers: X-QW-Api-Key: {你的API_KEY}
 *
 * 参考文档：https://dev.qweather.com/docs/configuration/authentication/
 *
 * ─── 缓存策略 ───
 * 天气数据通过 localStorage 缓存，key 为 'weather_cache'，存储结构为：
 *   { data: WeatherInfo, timestamp: number }
 *
 * 缓存 TTL 为 30 分钟（CACHE_TTL），依据：
 *   - 和风天气免费版 API 调用次数有限，不宜频繁请求
 *   - 天气变化不会非常剧烈，30 分钟更新一次对用户体验足够
 *   - 每次打开应用只请求一次，切 Tab 不会重复请求
 *
 * 读取流程：readCache() → 检查 timestamp 是否过期 → 未过期直接返回 data
 * 写入流程：API 请求成功后 writeCache() 存入当前时间戳 + 天气数据
 *
 * ─── 降级策略（共 4 层，保证天气模块永不阻断用户使用） ───
 *
 * 第 1 层 - 未配置降级：
 *   .env 中未配置 VITE_QWEATHER_KEY 或 VITE_QWEATHER_HOST 时，
 *   isWeatherConfigured() 返回 false，HomeView 中 v-if="weatherVisible" 为 false，
 *   整个天气胶囊不渲染 → 零开销，不影响页面其他功能。
 *
 * 第 2 层 - 缓存降级：
 *   getCurrentWeather() 优先读取 localStorage 缓存，若缓存未过期（30 分钟内），
 *   直接返回缓存数据，不发起网络请求 → 节省 API 调用次数，同时秒级响应。
 *
 * 第 3 层 - 运行时降级：
 *   定位失败（用户拒绝授权/设备不支持/超时）或 API 请求失败（网络异常/服务端错误）
 *   时，getCurrentWeather() 抛出异常。
 *   HomeView 中 fetchWeather() 使用 try/catch 吞掉异常，weather 保持 null →
 *   天气胶囊显示灰色云朵图标 + "获取中…" 文案，不崩溃、不白屏。
 *
 * 第 4 层 - 超时降级：
 *   API 请求设置 10 秒超时（AbortController），超时后自动中止请求并抛出超时错误，
 *   进入第 3 层的 catch 逻辑 → 用户不会因网络慢而无限等待。
 *
 * ─── 完整数据流 ───
 *
 *   App 启动 → HomeView.onMounted()
 *     → fetchWeather()
 *       → isWeatherConfigured() ?
 *           否 → 直接 return（天气胶囊不渲染，第 1 层降级）
 *           是 ↓
 *       → getCurrentWeather()
 *         → readCache() → 缓存有效？返回缓存数据（第 2 层降级）
 *         → getPosition() → 定位失败？抛错 → catch → weather=null（第 3 层降级）
 *         → fetch(API) → 超时？AbortError（第 4 层降级）
 *                     → 失败？抛错 → catch → weather=null（第 3 层降级）
 *                     → 成功？解析天气 → writeCache() → 返回 WeatherInfo
 *     → weather.value = info
 *     → 模板渲染：显示真实天气图标 + 文字 + 温度
 */

const API_KEY = import.meta.env.VITE_QWEATHER_KEY as string | undefined
const API_HOST = (import.meta.env.VITE_QWEATHER_HOST as string | undefined) || ''
const CACHE_KEY = 'weather_cache'
const CACHE_TTL = 30 * 60 * 1000 // 30 分钟缓存

export interface WeatherInfo {
  /** 天气文字描述（如"阴""小雨"） */
  text: string
  /** 温度（摄氏度） */
  temp: string
  /** 对应 AppleIcon 的图标名称 */
  icon: string
  /** 图标颜色 */
  color: string
}

interface WeatherCache {
  data: WeatherInfo
  timestamp: number
}

/** 检查天气 API 是否已配置（Key + Host 都必须存在） */
export function isWeatherConfigured(): boolean {
  return !!API_KEY && API_KEY.length > 0 && !!API_HOST && API_HOST.length > 0
}

/**
 * 将和风天气 icon code 映射为 AppleIcon 名称与颜色
 * 和风天气图标 code 参考：https://dev.qweather.com/docs/resource/icons/
 */
function mapWeatherCode(code: string): { icon: string; color: string } {
  const n = parseInt(code, 10)
  // 晴（100/150/900）
  if (n === 100 || n === 900) return { icon: 'sun', color: 'var(--chart-3)' }
  if (n === 150) return { icon: 'moon', color: 'var(--chart-2)' }
  // 多云（101/102/103/151/152/153）
  if ([101, 102, 103, 151, 152, 153].includes(n)) return { icon: 'cloud-sun', color: 'var(--chart-3)' }
  // 阴（104/154）
  if (n === 104 || n === 154) return { icon: 'cloud', color: 'var(--muted-foreground)' }
  // 雨（300-399）
  if (n >= 300 && n <= 399) return { icon: 'cloud-rain', color: 'var(--chart-1)' }
  // 雪（400-499）
  if (n >= 400 && n <= 499) return { icon: 'cloud-snow', color: 'var(--chart-2)' }
  // 雾/霾/沙尘（500-599）
  if (n >= 500 && n <= 599) return { icon: 'cloud-fog', color: 'var(--muted-foreground)' }
  // 冷（901）
  if (n === 901) return { icon: 'cloud', color: 'var(--chart-1)' }
  // 未知
  return { icon: 'cloud', color: 'var(--muted-foreground)' }
}

/**
 * 获取用户地理位置（经纬度）
 * 使用浏览器 navigator.geolocation API，Capacitor WebView 原生支持
 */
function getPosition(): Promise<{ lng: string; lat: string }> {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error('设备不支持定位'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // 和风天气 location 参数格式：经度,纬度
        resolve({
          lng: pos.coords.longitude.toFixed(2),
          lat: pos.coords.latitude.toFixed(2)
        })
      },
      (err) => {
        const messages: Record<number, string> = {
          1: '定位权限被拒绝',
          2: '定位不可用',
          3: '定位超时'
        }
        reject(new Error(messages[err.code] || '定位失败'))
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: CACHE_TTL }
    )
  })
}

/** 读取缓存的天气数据 */
function readCache(): WeatherInfo | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as WeatherCache
    if (Date.now() - cache.timestamp > CACHE_TTL) return null
    return cache.data
  } catch {
    return null
  }
}

/** 写入天气缓存 */
function writeCache(data: WeatherInfo): void {
  try {
    const cache: WeatherCache = { data, timestamp: Date.now() }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // localStorage 不可用时静默失败
  }
}

/**
 * 获取当前天气
 * 优先读缓存 → 定位 → 请求和风天气 API（专属 Host + 请求头认证）
 * 失败时抛错，由调用方处理
 */
export async function getCurrentWeather(): Promise<WeatherInfo> {
  // 1. 读缓存
  const cached = readCache()
  if (cached) return cached

  // 2. 检查配置
  if (!isWeatherConfigured()) {
    throw new Error('天气 API 未配置（需要 VITE_QWEATHER_KEY 和 VITE_QWEATHER_HOST）')
  }

  // 3. 获取定位
  const { lng, lat } = await getPosition()

  // 4. 请求和风天气 API（使用专属 Host + X-QW-Api-Key 请求头）
  const url = `https://${API_HOST}/v7/weather/now?location=${lng},${lat}`
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'X-QW-Api-Key': API_KEY!
      }
    })
    clearTimeout(timeoutId)

    if (!res.ok) throw new Error(`天气 API 请求失败: ${res.status}`)

    const json = await res.json()
    if (json.code !== '200') throw new Error(`天气 API 返回错误: ${json.code}`)

    const { icon, color } = mapWeatherCode(json.now.icon)
    const info: WeatherInfo = {
      text: json.now.text,
      temp: json.now.temp,
      icon,
      color
    }

    writeCache(info)
    return info
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('天气 API 请求超时')
    }
    throw err
  }
}
