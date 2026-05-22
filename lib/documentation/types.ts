export type DocumentationClassification = 'public' | 'internal' | 'restricted';
export type DocumentationReviewStatus = 'draft' | 'ai-classified' | 'review-required' | 'approved';
export type DocumentationClassificationSource = 'frontmatter' | 'policy';

export type DocumentationVisibility = DocumentationClassification;

export interface DocumentationDoc {
  id: string;
  slug: string;
  route: string;
  sourcePath: string;
  folderSlug: string;
  folderPath: string;
  title: string;
  summary: string;
  content: string;
  contentHash: string;
  readingMinutes: number;
  classification: DocumentationClassification;
  classificationSource: DocumentationClassificationSource;
  classificationConfidence: number;
  classificationReason: string;
  matchedPolicyRule: string;
  publish: boolean;
  reviewStatus: DocumentationReviewStatus;
  needsReview: boolean;
  visibility: DocumentationVisibility;
  audience: string[];
  tags: string[];
  warnings: string[];
  updatedAt: string;
}

export interface DocumentationFolder {
  id: string;
  slug: string;
  route: string;
  sourcePath: string;
  label: string;
  title: string;
  summary: string;
  parentSlug: string | null;
  folderSlugs: string[];
  docIds: string[];
  classificationCounts: Record<DocumentationClassification, number>;
  publishableCount: number;
  reviewRequiredCount: number;
  visibilityCounts: Record<DocumentationVisibility, number>;
  warnings: string[];
}

export interface DocumentationSyncInfo {
  generatedAt: string;
  generatorVersion: string;
  mode: 'heuristic' | 'ai-assisted';
  sourceRoot: string;
  manifestAudience: 'internal' | 'public';
  totalDocuments: number;
  totalFolders: number;
  publicDocuments: number;
  internalDocuments: number;
  restrictedDocuments: number;
  publishableDocuments: number;
  reviewRequiredDocuments: number;
  warningCount: number;
}

export interface DocumentationSiteManifest {
  sync: DocumentationSyncInfo;
  folders: DocumentationFolder[];
  docs: DocumentationDoc[];
  routes: string[];
}
