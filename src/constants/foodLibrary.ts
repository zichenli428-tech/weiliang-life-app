/**
 * 预置食物库（每 100g 营养值）
 * PRD 3.1：本地食物知识库 - P2 阶段提供预置常用食物，P3 阶段支持用户自定义扩展
 * 营养数据来源参考《中国食物成分表》，数值已做取整便于演示
 */
import type { DietFood } from '@/types/diet'

export interface FoodPreset {
  /** 食物名称 */
  name: string
  /** 分类 */
  category: FoodCategory
  /** 默认分量（克） */
  defaultAmount: number
  /** 每 100g 热量 kcal */
  caloriesPer100g: number
  /** 每 100g 蛋白质 g */
  proteinPer100g: number
  /** 每 100g 脂肪 g */
  fatPer100g: number
  /** 每 100g 碳水 g */
  carbsPer100g: number
}

export type FoodCategory =
  | 'staple' // 主食
  | 'meat' // 肉类
  | 'vegetable' // 蔬菜
  | 'fruit' // 水果
  | 'dairy' // 奶蛋豆
  | 'snack' // 零食饮料
  | 'other'

export const categoryLabels: Record<FoodCategory, { label: string; icon: string }> = {
  staple: { label: '主食', icon: '🍚' },
  meat: { label: '肉类', icon: '🥩' },
  vegetable: { label: '蔬菜', icon: '🥬' },
  fruit: { label: '水果', icon: '🍎' },
  dairy: { label: '奶蛋豆', icon: '🥚' },
  snack: { label: '零食', icon: '🍪' },
  other: { label: '其他', icon: '🍽️' }
}

/**
 * 预置食物库（30 项常用食物，覆盖日常三餐）
 */
export const foodLibrary: FoodPreset[] = [
  // 主食
  { name: '米饭', category: 'staple', defaultAmount: 150, caloriesPer100g: 116, proteinPer100g: 2.6, fatPer100g: 0.3, carbsPer100g: 25.9 },
  { name: '馒头', category: 'staple', defaultAmount: 100, caloriesPer100g: 223, proteinPer100g: 7.0, fatPer100g: 1.1, carbsPer100g: 47.0 },
  { name: '面条', category: 'staple', defaultAmount: 200, caloriesPer100g: 110, proteinPer100g: 3.5, fatPer100g: 0.6, carbsPer100g: 22.0 },
  { name: '全麦面包', category: 'staple', defaultAmount: 80, caloriesPer100g: 247, proteinPer100g: 9.0, fatPer100g: 3.4, carbsPer100g: 46.0 },
  { name: '燕麦片', category: 'staple', defaultAmount: 40, caloriesPer100g: 377, proteinPer100g: 13.0, fatPer100g: 6.7, carbsPer100g: 67.0 },
  { name: '红薯', category: 'staple', defaultAmount: 200, caloriesPer100g: 99, proteinPer100g: 1.1, fatPer100g: 0.2, carbsPer100g: 23.1 },
  // 肉类
  { name: '鸡胸肉', category: 'meat', defaultAmount: 100, caloriesPer100g: 133, proteinPer100g: 31.0, fatPer100g: 1.2, carbsPer100g: 0 },
  { name: '瘦猪肉', category: 'meat', defaultAmount: 100, caloriesPer100g: 143, proteinPer100g: 20.3, fatPer100g: 6.2, carbsPer100g: 0 },
  { name: '瘦牛肉', category: 'meat', defaultAmount: 100, caloriesPer100g: 106, proteinPer100g: 20.0, fatPer100g: 2.3, carbsPer100g: 0 },
  { name: '三文鱼', category: 'meat', defaultAmount: 100, caloriesPer100g: 208, proteinPer100g: 20.0, fatPer100g: 13.0, carbsPer100g: 0 },
  { name: '虾仁', category: 'meat', defaultAmount: 100, caloriesPer100g: 87, proteinPer100g: 18.6, fatPer100g: 0.8, carbsPer100g: 0 },
  // 蔬菜
  { name: '西兰花', category: 'vegetable', defaultAmount: 150, caloriesPer100g: 36, proteinPer100g: 4.1, fatPer100g: 0.6, carbsPer100g: 4.3 },
  { name: '菠菜', category: 'vegetable', defaultAmount: 150, caloriesPer100g: 28, proteinPer100g: 2.6, fatPer100g: 0.3, carbsPer100g: 4.5 },
  { name: '番茄', category: 'vegetable', defaultAmount: 150, caloriesPer100g: 20, proteinPer100g: 0.9, fatPer100g: 0.2, carbsPer100g: 4.0 },
  { name: '黄瓜', category: 'vegetable', defaultAmount: 150, caloriesPer100g: 15, proteinPer100g: 0.7, fatPer100g: 0.1, carbsPer100g: 2.9 },
  { name: '生菜', category: 'vegetable', defaultAmount: 100, caloriesPer100g: 16, proteinPer100g: 1.3, fatPer100g: 0.2, carbsPer100g: 2.0 },
  { name: '胡萝卜', category: 'vegetable', defaultAmount: 100, caloriesPer100g: 41, proteinPer100g: 1.0, fatPer100g: 0.2, carbsPer100g: 9.6 },
  // 水果
  { name: '苹果', category: 'fruit', defaultAmount: 200, caloriesPer100g: 53, proteinPer100g: 0.2, fatPer100g: 0.2, carbsPer100g: 13.5 },
  { name: '香蕉', category: 'fruit', defaultAmount: 150, caloriesPer100g: 93, proteinPer100g: 1.4, fatPer100g: 0.2, carbsPer100g: 22.0 },
  { name: '橙子', category: 'fruit', defaultAmount: 200, caloriesPer100g: 48, proteinPer100g: 0.8, fatPer100g: 0.2, carbsPer100g: 11.1 },
  { name: '葡萄', category: 'fruit', defaultAmount: 150, caloriesPer100g: 44, proteinPer100g: 0.5, fatPer100g: 0.2, carbsPer100g: 10.3 },
  // 奶蛋豆
  { name: '鸡蛋', category: 'dairy', defaultAmount: 60, caloriesPer100g: 147, proteinPer100g: 12.7, fatPer100g: 9.0, carbsPer100g: 1.3 },
  { name: '牛奶', category: 'dairy', defaultAmount: 250, caloriesPer100g: 54, proteinPer100g: 3.0, fatPer100g: 3.2, carbsPer100g: 3.4 },
  { name: '酸奶', category: 'dairy', defaultAmount: 150, caloriesPer100g: 72, proteinPer100g: 2.5, fatPer100g: 2.7, carbsPer100g: 9.3 },
  { name: '豆腐', category: 'dairy', defaultAmount: 100, caloriesPer100g: 73, proteinPer100g: 8.1, fatPer100g: 3.7, carbsPer100g: 3.8 },
  { name: '豆浆', category: 'dairy', defaultAmount: 250, caloriesPer100g: 31, proteinPer100g: 3.0, fatPer100g: 1.6, carbsPer100g: 1.2 },
  // 零食饮料
  { name: '坚果', category: 'snack', defaultAmount: 30, caloriesPer100g: 607, proteinPer100g: 18.0, fatPer100g: 53.0, carbsPer100g: 19.0 },
  { name: '黑巧克力', category: 'snack', defaultAmount: 20, caloriesPer100g: 546, proteinPer100g: 8.0, fatPer100g: 31.0, carbsPer100g: 56.0 },
  { name: '可乐', category: 'snack', defaultAmount: 330, caloriesPer100g: 43, proteinPer100g: 0, fatPer100g: 0, carbsPer100g: 10.6 },
  { name: '咖啡', category: 'snack', defaultAmount: 250, caloriesPer100g: 2, proteinPer100g: 0.2, fatPer100g: 0, carbsPer100g: 0 }
]

/**
 * 根据预置食物 + 重量构建 DietFood
 */
export function buildDietFood(preset: FoodPreset, amount?: number): DietFood {
  const gram = amount ?? preset.defaultAmount
  const ratio = gram / 100
  return {
    name: preset.name,
    amount: gram,
    calories: Math.round(preset.caloriesPer100g * ratio),
    protein: Math.round(preset.proteinPer100g * ratio * 10) / 10,
    fat: Math.round(preset.fatPer100g * ratio * 10) / 10,
    carbs: Math.round(preset.carbsPer100g * ratio * 10) / 10
  }
}

/**
 * 构建一条自定义食物（用户手动输入名称和营养值）
 */
export function buildCustomFood(name: string, amount: number, calories: number): DietFood {
  return {
    name,
    amount,
    calories,
    protein: 0,
    fat: 0,
    carbs: 0
  }
}
