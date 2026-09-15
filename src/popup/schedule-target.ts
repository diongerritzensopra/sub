import type { WeeklyScheduleTarget } from '../shared/types';

export function getScheduleTargetDisplayName(
  target: WeeklyScheduleTarget,
): string {
  const trimmedName = target.targetLabel?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  return target.targetType === 'project'
    ? 'Onbekend project'
    : 'Onbekende algemene uren';
}

export function encodeScheduleTargetSelectValue(
  target: Pick<WeeklyScheduleTarget, 'targetType' | 'targetCode'>,
): string {
  return JSON.stringify({
    targetType: target.targetType,
    targetCode: target.targetCode,
  });
}

export function decodeScheduleTargetSelectValue(
  value: string,
): Pick<WeeklyScheduleTarget, 'targetType' | 'targetCode'> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<WeeklyScheduleTarget>;
    if (
      (parsed.targetType === 'project' ||
        parsed.targetType === 'general-hours') &&
      typeof parsed.targetCode === 'string' &&
      parsed.targetCode.length > 0
    ) {
      return {
        targetType: parsed.targetType,
        targetCode: parsed.targetCode,
      };
    }
  } catch {
    // Ignore malformed values and let the caller surface a validation error.
  }

  return null;
}


