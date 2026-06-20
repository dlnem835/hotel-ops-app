import {
  LocalizedText,
  PropertyTemplateContent,
  StandardCategoryDef,
  StandardItemDef,
  StandardTemplateDefinition,
  TemplateLanguage,
} from "./types";

export function L(en: string, es: string): LocalizedText {
  return { en, es };
}

export function stdItem(
  key: string,
  label: LocalizedText,
  pointValue: number,
  required = true
): StandardItemDef {
  return { key, label, pointValue, required };
}

export function stdCategory(
  key: string,
  name: LocalizedText,
  items: StandardItemDef[]
): StandardCategoryDef {
  return { key, name, items };
}

export function standardToPropertyContent(
  standard: StandardTemplateDefinition
): PropertyTemplateContent {
  return {
    categories: standard.categories.map((cat, catIndex) => ({
      key: cat.key,
      name: { ...cat.name },
      sortOrder: catIndex,
      items: cat.items.map((entry, itemIndex) => ({
        key: entry.key,
        label: { ...entry.label },
        pointValue: entry.pointValue,
        required: entry.required,
        sortOrder: itemIndex,
      })),
    })),
  };
}

export function countContentItems(content: PropertyTemplateContent): number {
  return content.categories.reduce((sum, cat) => sum + cat.items.length, 0);
}

export function countContentPoints(content: PropertyTemplateContent): number {
  return content.categories.reduce(
    (sum, cat) =>
      sum + cat.items.reduce((itemSum, item) => itemSum + item.pointValue, 0),
    0
  );
}

export function getLocalized(text: LocalizedText, language: TemplateLanguage): string {
  return language === "es" ? text.es || text.en : text.en;
}
