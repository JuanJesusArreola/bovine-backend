// src/utils/fileCategoryMapping.ts
import { MediaCategory } from '../models/RanchMedia';
import { FileCategory } from '../middleware/upload';

export const mapMediaCategoryToFileCategory = (category: MediaCategory): FileCategory => {
  const mapping: Record<MediaCategory, FileCategory> = {
    [MediaCategory.LOGO]: FileCategory.GENERAL_DOCS,
    [MediaCategory.AERIAL_PHOTO]: FileCategory.CATTLE_PHOTOS,
    [MediaCategory.SATELLITE_IMAGE]: FileCategory.CATTLE_PHOTOS,
    [MediaCategory.PROPERTY_MAP]: FileCategory.GENERAL_DOCS,
    [MediaCategory.FACILITY_PHOTO]: FileCategory.CATTLE_PHOTOS,
    [MediaCategory.LIVESTOCK_PHOTO]: FileCategory.CATTLE_PHOTOS,
    [MediaCategory.CERTIFICATE]: FileCategory.VETERINARY_DOCS,
    [MediaCategory.LICENSE]: FileCategory.VETERINARY_DOCS,
    [MediaCategory.CONTRACT]: FileCategory.FINANCIAL_DOCS,
    [MediaCategory.REPORT]: FileCategory.HEALTH_REPORTS,
    [MediaCategory.PLAN]: FileCategory.GENERAL_DOCS,
    [MediaCategory.LEGAL_DOCUMENT]: FileCategory.FINANCIAL_DOCS,
    [MediaCategory.FINANCIAL_DOCUMENT]: FileCategory.FINANCIAL_DOCS,
    [MediaCategory.OTHER]: FileCategory.GENERAL_DOCS,
  };
  return mapping[category] || FileCategory.GENERAL_DOCS;
};