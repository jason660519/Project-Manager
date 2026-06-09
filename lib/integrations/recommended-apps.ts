export type RecommendedAppCategory = 'Productivity';

export interface RecommendedApp {
  name: string;
  category: RecommendedAppCategory;
  primaryFunction: string;
  websiteUrl: string;
}

/** Curated install recommendations shown on the System Installed Apps sheet. */
export const RECOMMENDED_INSTALL_APPS: readonly RecommendedApp[] = [
  {
    name: 'HighLevel',
    category: 'Productivity',
    primaryFunction: '智慧互動 CRM 業務數據',
    websiteUrl: 'https://www.gohighlevel.com',
  },
  {
    name: 'Adobe Express',
    category: 'Productivity',
    primaryFunction: '設計、個人化和編輯海報、邀請函等',
    websiteUrl: 'https://www.adobe.com/express',
  },
  {
    name: 'Adobe Acrobat',
    category: 'Productivity',
    primaryFunction: '編輯、組織、修訂 PDF 工具',
    websiteUrl: 'https://www.adobe.com/acrobat',
  },
  {
    name: 'Adobe Photoshop',
    category: 'Productivity',
    primaryFunction: '編輯圖片、添加效果、微調創意工具',
    websiteUrl: 'https://www.adobe.com/products/photoshop.html',
  },
] as const;
