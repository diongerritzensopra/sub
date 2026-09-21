import type { TimesheetTarget } from '../shared/types';

export function getScheduleTargetDisplayName(target: TimesheetTarget): string {
  return target.targetLabel.trim();
}

export function encodeScheduleTargetSelectValue(
  target: Pick<TimesheetTarget, 'targetType' | 'targetCode'>,
): string {
  return JSON.stringify({
    targetType: target.targetType,
    targetCode: target.targetCode,
  });
}

export function decodeScheduleTargetSelectValue(
  value: string,
): Pick<TimesheetTarget, 'targetType' | 'targetCode'> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<TimesheetTarget>;
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
