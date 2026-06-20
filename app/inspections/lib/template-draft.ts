import {
  PropertyInspectionTemplate,
  PropertyTemplateContent,
  TemplateLanguage,
  TemplateStatus,
  TemplateType,
} from "../standards/types";

export type ItemDraft = {
  clientId: string;
  key: string;
  labelEn: string;
  labelEs: string;
  pointValue: number;
  required: boolean;
  sortOrder: number;
};

export type CategoryDraft = {
  clientId: string;
  key: string;
  nameEn: string;
  nameEs: string;
  sortOrder: number;
  items: ItemDraft[];
};

export type TemplateContentDraft = {
  name: string;
  template_type: TemplateType;
  status: TemplateStatus;
  categories: CategoryDraft[];
};

function newClientId() {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyItem(sortOrder: number): ItemDraft {
  return {
    clientId: newClientId(),
    key: `item-${sortOrder}`,
    labelEn: "",
    labelEs: "",
    pointValue: 1,
    required: true,
    sortOrder,
  };
}

export function emptyCategory(sortOrder: number): CategoryDraft {
  return {
    clientId: newClientId(),
    key: `category-${sortOrder}`,
    nameEn: "",
    nameEs: "",
    sortOrder,
    items: [emptyItem(0)],
  };
}

export function propertyTemplateToDraft(
  template: PropertyInspectionTemplate
): TemplateContentDraft {
  return {
    name: template.name,
    template_type: template.template_type,
    status: template.status,
    categories: template.content.categories.map((cat) => ({
      clientId: newClientId(),
      key: cat.key,
      nameEn: cat.name.en,
      nameEs: cat.name.es,
      sortOrder: cat.sortOrder,
      items: cat.items.map((item) => ({
        clientId: newClientId(),
        key: item.key,
        labelEn: item.label.en,
        labelEs: item.label.es,
        pointValue: item.pointValue,
        required: item.required,
        sortOrder: item.sortOrder,
      })),
    })),
  };
}

export function contentToDraft(
  name: string,
  template_type: TemplateType,
  status: TemplateStatus,
  content: PropertyTemplateContent
): TemplateContentDraft {
  return {
    name,
    template_type,
    status,
    categories: content.categories.map((cat) => ({
      clientId: newClientId(),
      key: cat.key,
      nameEn: cat.name.en,
      nameEs: cat.name.es,
      sortOrder: cat.sortOrder,
      items: cat.items.map((item) => ({
        clientId: newClientId(),
        key: item.key,
        labelEn: item.label.en,
        labelEs: item.label.es,
        pointValue: item.pointValue,
        required: item.required,
        sortOrder: item.sortOrder,
      })),
    })),
  };
}

export function draftToContent(draft: TemplateContentDraft): PropertyTemplateContent {
  return {
    categories: draft.categories
      .filter((cat) => cat.nameEn.trim() || cat.nameEs.trim())
      .map((cat, catIndex) => ({
        key: cat.key || `category-${catIndex}`,
        name: { en: cat.nameEn.trim(), es: cat.nameEs.trim() || cat.nameEn.trim() },
        sortOrder: catIndex,
        items: cat.items
          .filter((item) => item.labelEn.trim() || item.labelEs.trim())
          .map((item, itemIndex) => ({
            key: item.key || `item-${itemIndex}`,
            label: {
              en: item.labelEn.trim(),
              es: item.labelEs.trim() || item.labelEn.trim(),
            },
            pointValue: Number(item.pointValue) || 0,
            required: item.required,
            sortOrder: itemIndex,
          })),
      }))
      .filter((cat) => cat.items.length > 0),
  };
}

export function formatTemplateDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function getDraftLabel(item: ItemDraft, language: TemplateLanguage): string {
  return language === "es" ? item.labelEs || item.labelEn : item.labelEn;
}

export function getDraftCategoryName(
  category: CategoryDraft,
  language: TemplateLanguage
): string {
  return language === "es" ? category.nameEs || category.nameEn : category.nameEn;
}

export function setDraftLabel(
  item: ItemDraft,
  language: TemplateLanguage,
  value: string
): ItemDraft {
  return language === "es" ? { ...item, labelEs: value } : { ...item, labelEn: value };
}

export function setDraftCategoryName(
  category: CategoryDraft,
  language: TemplateLanguage,
  value: string
): CategoryDraft {
  return language === "es"
    ? { ...category, nameEs: value }
    : { ...category, nameEn: value };
}
