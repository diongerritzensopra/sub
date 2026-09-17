import { describe, expect, it } from 'vitest';

import type { TimesheetTarget } from '../shared/types';
import {
  decodeScheduleTargetSelectValue,
  encodeScheduleTargetSelectValue,
  getScheduleTargetDisplayName,
} from './schedule-target';

describe('getScheduleTargetDisplayName', () => {
  it('returns trimmed target label', () => {
    const target: TimesheetTarget = {
      targetType: 'project',
      targetCode: 'C001',
      targetLabel: 'Project Alpha',
    };

    expect(getScheduleTargetDisplayName(target)).toBe('Project Alpha');
  });

  it('removes leading and trailing whitespace from label', () => {
    const target: TimesheetTarget = {
      targetType: 'project',
      targetCode: 'C001',
      targetLabel: '  Project Beta  ',
    };

    expect(getScheduleTargetDisplayName(target)).toBe('Project Beta');
  });

  it('handles empty label after trimming', () => {
    const target: TimesheetTarget = {
      targetType: 'general-hours',
      targetCode: 'MISC',
      targetLabel: '   ',
    };

    expect(getScheduleTargetDisplayName(target)).toBe('');
  });
});

describe('encodeScheduleTargetSelectValue', () => {
  it('encodes project target to JSON string', () => {
    const target = { targetType: 'project' as const, targetCode: 'C001' };

    const encoded = encodeScheduleTargetSelectValue(target);

    expect(encoded).toBe('{"targetType":"project","targetCode":"C001"}');
  });

  it('encodes general-hours target to JSON string', () => {
    const target = { targetType: 'general-hours' as const, targetCode: 'MISC' };

    const encoded = encodeScheduleTargetSelectValue(target);

    expect(encoded).toBe('{"targetType":"general-hours","targetCode":"MISC"}');
  });

  it('handles target codes with special characters', () => {
    const target = {
      targetType: 'project' as const,
      targetCode: 'C-001-TEST',
    };

    const encoded = encodeScheduleTargetSelectValue(target);

    expect(encoded).toBe('{"targetType":"project","targetCode":"C-001-TEST"}');
  });

  it('produces consistent encoding for same input', () => {
    const target = { targetType: 'project' as const, targetCode: 'C001' };

    const encoded1 = encodeScheduleTargetSelectValue(target);
    const encoded2 = encodeScheduleTargetSelectValue(target);

    expect(encoded1).toBe(encoded2);
  });
});

describe('decodeScheduleTargetSelectValue', () => {
  it('decodes project target from JSON string', () => {
    const value = '{"targetType":"project","targetCode":"C001"}';

    const decoded = decodeScheduleTargetSelectValue(value);

    expect(decoded).toEqual({
      targetType: 'project',
      targetCode: 'C001',
    });
  });

  it('decodes general-hours target from JSON string', () => {
    const value = '{"targetType":"general-hours","targetCode":"MISC"}';

    const decoded = decodeScheduleTargetSelectValue(value);

    expect(decoded).toEqual({
      targetType: 'general-hours',
      targetCode: 'MISC',
    });
  });

  it('returns null for empty string', () => {
    expect(decodeScheduleTargetSelectValue('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(decodeScheduleTargetSelectValue('not json')).toBeNull();
  });

  it('returns null for JSON with missing targetType', () => {
    const value = '{"targetCode":"C001"}';

    expect(decodeScheduleTargetSelectValue(value)).toBeNull();
  });

  it('returns null for JSON with missing targetCode', () => {
    const value = '{"targetType":"project"}';

    expect(decodeScheduleTargetSelectValue(value)).toBeNull();
  });

  it('returns null for JSON with empty targetCode', () => {
    const value = '{"targetType":"project","targetCode":""}';

    expect(decodeScheduleTargetSelectValue(value)).toBeNull();
  });

  it('returns null for JSON with invalid targetType', () => {
    const value = '{"targetType":"invalid","targetCode":"C001"}';

    expect(decodeScheduleTargetSelectValue(value)).toBeNull();
  });

  it('returns null for JSON with targetCode that is not a string', () => {
    const value = '{"targetType":"project","targetCode":123}';

    expect(decodeScheduleTargetSelectValue(value)).toBeNull();
  });

  it('roundtrips encode then decode successfully', () => {
    const target = { targetType: 'project' as const, targetCode: 'C001' };

    const encoded = encodeScheduleTargetSelectValue(target);
    const decoded = decodeScheduleTargetSelectValue(encoded);

    expect(decoded).toEqual(target);
  });

  it('roundtrips general-hours encode then decode successfully', () => {
    const target = {
      targetType: 'general-hours' as const,
      targetCode: 'MISC',
    };

    const encoded = encodeScheduleTargetSelectValue(target);
    const decoded = decodeScheduleTargetSelectValue(encoded);

    expect(decoded).toEqual(target);
  });
});
