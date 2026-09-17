import { Service } from '../src/types';

export interface LicenceImportRow {
  row: number;
  variantId: string;
  licenceCode: string;
  codeType?: string;
  notes?: string;
}

export interface ValidationError {
  row?: number;
  field?: string;
  message: string;
}

export function validateLicenceRows(
  rows: LicenceImportRow[],
  knownVariantIds: Set<string>,
  existingCodes: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const seen = new Map<string, number>();

  rows.forEach((row, index) => {
    const number = row.row || index + 1;
    const variantId = String(row.variantId || '').trim();
    const code = String(row.licenceCode || '').trim();
    if (!variantId) errors.push({ row: number, field: 'variantId', message: 'Variant id is required.' });
    else if (!knownVariantIds.has(variantId)) {
      errors.push({ row: number, field: 'variantId', message: `Unknown variant id: ${variantId}.` });
    }
    if (!code) errors.push({ row: number, field: 'licenceCode', message: 'Licence key is required.' });
    if (code && existingCodes.has(code)) {
      errors.push({ row: number, field: 'licenceCode', message: 'This key already exists in stock.' });
    }
    if (code && seen.has(code)) {
      errors.push({
        row: number,
        field: 'licenceCode',
        message: `Duplicate key in this batch (first seen on row ${seen.get(code)}).`
      });
    } else if (code) {
      seen.set(code, number);
    }
  });

  if (!rows.length) errors.push({ message: 'Add at least one licence key.' });
  return errors;
}

export function validateServiceDefinition(service: Service): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!service.serviceId?.trim()) errors.push({ field: 'serviceId', message: 'Service id is required.' });
  if (!service.name?.trim()) errors.push({ field: 'name', message: 'Name is required.' });
  if (!service.categoryId?.trim()) errors.push({ field: 'categoryId', message: 'Category is required.' });
  if (!service.ctaLabel?.trim()) errors.push({ field: 'ctaLabel', message: 'CTA label is required.' });
  if (!Number.isFinite(service.sortOrder)) errors.push({ field: 'sortOrder', message: 'Sort order must be a number.' });

  const keys = new Set<string>();
  for (const field of service.fields || []) {
    const key = field.key?.trim();
    if (!key) errors.push({ field: 'fields', message: 'Every field needs a key.' });
    else if (keys.has(key)) errors.push({ field: 'fields', message: `Duplicate field key: ${key}.` });
    else keys.add(key);
    if (!field.label?.trim()) errors.push({ field: 'fields', message: `Field ${key || '?'} needs a label.` });
    if ((field.type === 'select' || field.type === 'radio') && !(field.options || []).filter(Boolean).length) {
      errors.push({ field: 'fields', message: `${field.label || key} needs at least one option.` });
    }
  }

  for (const field of service.fields || []) {
    if (field.showIf && !keys.has(field.showIf.field)) {
      errors.push({
        field: 'fields',
        message: `${field.label || field.key} depends on missing field ${field.showIf.field}.`
      });
    }
  }

  const optionIds = new Set<string>();
  for (const option of service.options || []) {
    if (!option.optionId?.trim()) errors.push({ field: 'options', message: 'Every priced option needs an id.' });
    else if (optionIds.has(option.optionId)) {
      errors.push({ field: 'options', message: `Duplicate option id: ${option.optionId}.` });
    } else optionIds.add(option.optionId);
    if (!option.name?.trim()) errors.push({ field: 'options', message: 'Every priced option needs a name.' });
    if (!Number.isFinite(option.unitPriceGhs) || option.unitPriceGhs <= 0) {
      errors.push({ field: 'options', message: `${option.name || option.optionId} needs a positive unit price.` });
    }
    const hasBulkPrice = option.bulkPriceGhs != null;
    const hasBulkQty = option.bulkFromQty != null;
    if (hasBulkPrice !== hasBulkQty) {
      errors.push({
        field: 'options',
        message: `${option.name || option.optionId} needs both a bulk price and bulk-from quantity.`
      });
    }
    if (hasBulkPrice && (!Number.isFinite(option.bulkPriceGhs) || (option.bulkPriceGhs as number) <= 0)) {
      errors.push({ field: 'options', message: `${option.name || option.optionId} has an invalid bulk price.` });
    }
    if (hasBulkQty && (!Number.isInteger(option.bulkFromQty) || (option.bulkFromQty as number) < 2)) {
      errors.push({ field: 'options', message: `${option.name || option.optionId} bulk quantity must be at least 2.` });
    }
  }

  const minQty = service.minQty ?? 1;
  const maxQty = service.maxQty ?? 50;
  if (!Number.isInteger(minQty) || minQty < 1) errors.push({ field: 'minQty', message: 'Minimum quantity must be at least 1.' });
  if (!Number.isInteger(maxQty) || maxQty < minQty) {
    errors.push({ field: 'maxQty', message: 'Maximum quantity must be at least the minimum.' });
  }
  return errors;
}
