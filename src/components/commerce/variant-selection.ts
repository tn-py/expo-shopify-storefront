import type { Product, ProductVariant } from '@/shopify/types';

export type VariantSelection = {
  selection: Record<string, string>;
  variant: ProductVariant | null;
};

function selectionForVariant(variant: ProductVariant): Record<string, string> {
  return Object.fromEntries(variant.selectedOptions.map(({ name, value }) => [name, value]));
}

function exactlyMatches(variant: ProductVariant, selection: Record<string, string>): boolean {
  return variant.selectedOptions.every(({ name, value }) => selection[name] === value);
}

export function resolveVariantSelection(
  product: Product,
  requestedSelection: Record<string, string>,
): VariantSelection {
  const variants = product.variants.nodes;
  if (!variants.length) return { selection: {}, variant: null };

  const exactAvailable = variants.find(
    (variant) => variant.availableForSale && exactlyMatches(variant, requestedSelection),
  );
  if (exactAvailable) {
    return { selection: selectionForVariant(exactAvailable), variant: exactAvailable };
  }

  let candidates = variants.filter((variant) => variant.availableForSale);
  if (!candidates.length) candidates = variants;

  for (const option of product.options) {
    const requestedValue = requestedSelection[option.name];
    if (!requestedValue) continue;
    const matching = candidates.filter((variant) =>
      variant.selectedOptions.some(
        ({ name, value }) => name === option.name && value === requestedValue,
      ),
    );
    if (matching.length) candidates = matching;
  }

  const variant = candidates[0] ?? null;
  return {
    selection: variant ? selectionForVariant(variant) : {},
    variant,
  };
}

export function getAvailableOptionValues(
  product: Product,
  selection: Record<string, string>,
  optionName: string,
): Set<string> {
  const available = new Set<string>();
  const optionIndex = product.options.findIndex((option) => option.name === optionName);
  const earlierOptionNames = new Set(
    product.options.slice(0, Math.max(0, optionIndex)).map((option) => option.name),
  );
  for (const variant of product.variants.nodes) {
    if (!variant.availableForSale) continue;
    const matchesEarlierOptions = variant.selectedOptions.every(
      ({ name, value }) => !earlierOptionNames.has(name) || !selection[name] || selection[name] === value,
    );
    if (!matchesEarlierOptions) continue;
    const value = variant.selectedOptions.find(({ name }) => name === optionName)?.value;
    if (value) available.add(value);
  }
  return available;
}
