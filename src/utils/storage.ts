/**
 * 本地数据库封装层（基于 localforage / IndexedDB）
 *
 * PRD 4.3 数据安全与隐私：
 * - Demo 阶段所有用户数据（聊天记录、身体数据、饮食记录）仅存储在浏览器 IndexedDB
 * - 不上传服务器
 *
 * 设计：按业务划分独立的 localforage 实例，避免数据耦合，便于后续迁移。
 *
 * 注意：Vue 3 的 ref/reactive 会将对象包装成 Proxy，IndexedDB 的结构化克隆算法
 * 无法克隆 Proxy（尤其是嵌套对象/数组），会抛出 DataCloneError。
 * 因此 setItem 在写入前统一用 JSON 序列化将 Proxy 转为纯对象。
 */
import localforage from 'localforage'

const DB_NAME = 'weiliang-life'

/** 业务 store 实例枚举 */
export type StoreName =
  | 'user' // 身体档案、目标设定
  | 'diet' // 饮食记录
  | 'sleep' // 睡眠记录
  | 'chat' // AI 对话记录
  | 'mind' // 心理疏导会话
  | 'mood' // 情绪日记
  | 'foodDB' // 用户自定义食物库（PRD 3.1）
  | 'pending' // 离线待识别队列（PRD 7.1）

const storeInstances: Record<StoreName, LocalForage> = {} as Record<StoreName, LocalForage>

/**
 * 获取指定业务的 localforage 实例（单例）
 * 每个 storeName 对应一个独立的 IndexedDB objectStore
 */
export function getStore(storeName: StoreName): LocalForage {
  if (!storeInstances[storeName]) {
    storeInstances[storeName] = localforage.createInstance({
      name: DB_NAME,
      storeName,
      description: '微量生活本地数据存储'
    })
  }
  return storeInstances[storeName]
}

/**
 * 将 Vue 响应式 Proxy 转为纯对象（深度）
 * 解决 IndexedDB 结构化克隆无法处理 Proxy 的问题（DataCloneError）
 */
function toPlain<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value
  return JSON.parse(JSON.stringify(value))
}

/** 通用读取 */
export async function getItem<T = unknown>(storeName: StoreName, key: string): Promise<T | null> {
  return (await getStore(storeName).getItem<T>(key)) ?? null
}

/** 通用写入（自动将 Proxy 转为纯对象，避免 DataCloneError） */
export async function setItem<T = unknown>(storeName: StoreName, key: string, value: T): Promise<void> {
  const plain = toPlain(value)
  await getStore(storeName).setItem<T>(key, plain as T)
}

/** 通用删除 */
export async function removeItem(storeName: StoreName, key: string): Promise<void> {
  await getStore(storeName).removeItem(key)
}

/** 清空指定业务 store 的所有数据 */
export async function clearStore(storeName: StoreName): Promise<void> {
  await getStore(storeName).clear()
}

/** 获取指定业务 store 的所有 key */
export async function keys(storeName: StoreName): Promise<string[]> {
  return await getStore(storeName).keys()
}

/** 获取指定业务 store 的数据条数 */
export async function length(storeName: StoreName): Promise<number> {
  return await getStore(storeName).length()
}

/**
 * 遍历指定业务 store 的所有数据
 * @param storeName 业务名
 * @param callback 回调 (value, key, iterationNumber)
 */
export async function iterate<T = unknown>(
  storeName: StoreName,
  callback: (value: T, key: string, iterationNumber: number) => void
): Promise<void> {
  await getStore(storeName).iterate<T, void>((value, key, iterationNumber) => {
    callback(value, key, iterationNumber)
  })
}
