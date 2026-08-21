export type SupplyCategory = 'pixelPet' | 'nbaStar'

export const THEME_META: Record<
  SupplyCategory,
  {
    label: string
    icon: string
    accentColor: string
    rareColor: string
    drawTitle: string
    collectionTitle: string
    collectionDesc: string
    poolCommonLabel: string
    poolRareLabel: string
    equipLabel: string
    unitLabel: string
  }
> = {
  pixelPet: {
    label: '像素萌宠',
    icon: '🐱',
    accentColor: '#3b82f6',
    rareColor: '#3b82f6',
    drawTitle: '像素补给站',
    collectionTitle: '我的图鉴 · 像素萌宠',
    collectionDesc: '收集全部像素萌宠',
    poolCommonLabel: '常驻伙伴',
    poolRareLabel: '珍稀伙伴',
    equipLabel: '设为首页展示',
    unitLabel: '只',
  },
  nbaStar: {
    label: 'NBA 球星',
    icon: '🏀',
    accentColor: '#ea580c',
    rareColor: '#d97706',
    drawTitle: '球星卡补给站',
    collectionTitle: '我的图鉴 · NBA 球星卡',
    collectionDesc: '收集全部 NBA 球星卡',
    poolCommonLabel: '常规球星',
    poolRareLabel: '巨星球星',
    equipLabel: '设为首页展示',
    unitLabel: '张',
  },
}

export const RARITY_LABELS: Record<string, string> = {
  common: '普通',
  rare: '稀有',
}

/** Web 端直接使用后端返回的 imageUrl（public/collection 下的静态资源） */
export function getCollectionImageUrl(imageUrl: string): string {
  return imageUrl || '/collection/pet-orangecat-120.png'
}