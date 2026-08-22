/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { ConditionEditor } from './condition.editor';
import { PostRuleCapabilitiesResponse } from '@gitroom/nestjs-libraries/dtos/rules/rule.types';

jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (key: string, fallback: string) => fallback,
}));

describe('ConditionEditor', () => {
  const mockCapabilities: PostRuleCapabilitiesResponse = {
    actions: [
      {
        key: 'REMOVE',
        label: 'Remove',
        metrics: [
          { key: 'LIKES', label: 'Likes' },
          { key: 'REPLIES', label: 'Replies' },
        ],
      },
    ],
    providers: [],
  };

  const mockProps = {
    action: 'REMOVE' as const,
    capabilities: mockCapabilities,
    conditionMatch: 'ANY' as const,
    conditions: [],
    onConditionMatchChange: jest.fn(),
    onConditionsChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render empty state when no conditions', () => {
    render(<ConditionEditor {...mockProps} />);

    expect(
      screen.getByText('No conditions defined. The action will always execute.')
    ).toBeTruthy();
  });

  it('should render add condition button', () => {
    render(<ConditionEditor {...mockProps} />);

    expect(screen.getByText('Add Condition')).toBeTruthy();
  });

  it('should add a new condition', () => {
    render(<ConditionEditor {...mockProps} />);

    fireEvent.click(screen.getByText('Add Condition'));

    expect(mockProps.onConditionsChange).toHaveBeenCalledWith([
      {
        metric: 'LIKES',
        operator: 'LT',
        threshold: 10,
      },
    ]);
  });

  it('should render existing conditions', () => {
    const propsWithConditions = {
      ...mockProps,
      conditions: [
        {
          metric: 'LIKES' as const,
          operator: 'LT' as const,
          threshold: 10,
        },
      ],
    };

    render(<ConditionEditor {...propsWithConditions} />);

    expect(screen.getByText('Execute when')).toBeTruthy();
    expect(screen.getByDisplayValue('10')).toBeTruthy();
  });

  it('should remove a condition', () => {
    const propsWithConditions = {
      ...mockProps,
      conditions: [
        {
          metric: 'LIKES' as const,
          operator: 'LT' as const,
          threshold: 10,
        },
      ],
    };

    render(<ConditionEditor {...propsWithConditions} />);

    fireEvent.click(screen.getByText('Remove'));

    expect(mockProps.onConditionsChange).toHaveBeenCalledWith([]);
  });

  it('should update condition threshold', () => {
    const propsWithConditions = {
      ...mockProps,
      conditions: [
        {
          metric: 'LIKES' as const,
          operator: 'LT' as const,
          threshold: 10,
        },
      ],
    };

    render(<ConditionEditor {...propsWithConditions} />);

    const input = screen.getByDisplayValue('10');
    fireEvent.change(input, { target: { value: '20' } });

    expect(mockProps.onConditionsChange).toHaveBeenCalledWith([
      {
        metric: 'LIKES',
        operator: 'LT',
        threshold: 20,
      },
    ]);
  });

  it('should change condition match', () => {
    const propsWithConditions = {
      ...mockProps,
      conditions: [
        {
          metric: 'LIKES' as const,
          operator: 'LT' as const,
          threshold: 10,
        },
        {
          metric: 'REPLIES' as const,
          operator: 'GT' as const,
          threshold: 5,
        },
      ],
    };

    render(<ConditionEditor {...propsWithConditions} />);

    const matchSelect = screen.getByDisplayValue('ANY');
    fireEvent.change(matchSelect, { target: { value: 'ALL' } });

    expect(mockProps.onConditionMatchChange).toHaveBeenCalledWith('ALL');
  });
});
