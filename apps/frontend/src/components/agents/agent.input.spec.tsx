/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Input } from './agent.input';

const useAgentSkills = jest.fn();

jest.mock('@copilotkit/react-core', () => ({
  useCopilotContext: () => ({ copilotApiConfig: {} }),
  useCopilotReadable: jest.fn(),
}));
jest.mock('@copilotkit/react-ui', () => ({
  useChatContext: () => ({
    labels: { placeholder: 'Message' },
    icons: { sendIcon: 'Send', stopIcon: 'Stop', uploadIcon: 'Upload' },
  }),
}));
jest.mock('./use.agent.skills', () => ({ useAgentSkills: () => useAgentSkills() }));

const skills = [
  {
    id: 'campaign',
    slug: 'campaign',
    command: '/campaign',
    name: 'campaign.skill.md',
    fileSize: 100,
    updatedAt: '2026-01-01',
    isLarge: false,
  },
  {
    id: 'campaign-review',
    slug: 'campaign-review',
    command: '/campaign-review',
    name: 'campaign-review.skill.md',
    fileSize: 100,
    updatedAt: '2026-01-01',
    isLarge: false,
  },
  {
    id: 'caption',
    slug: 'caption',
    command: '/caption',
    name: 'caption.skill.md',
    fileSize: 100,
    updatedAt: '2026-01-01',
    isLarge: false,
  },
];

const renderInput = () => {
  const onSend = jest.fn();
  const onChange = jest.fn();
  render(
    <Input
      inProgress={false}
      onSend={onSend}
      onChange={onChange}
      onStop={jest.fn()}
    />
  );
  return { onSend, onChange, textarea: screen.getByRole('combobox') };
};

describe('agent skill autocomplete', () => {
  beforeEach(() => {
    useAgentSkills.mockReturnValue({ data: skills, isLoading: false });
  });

  it('filters commands and inserts a mouse-selected command without sending', () => {
    const { onSend, onChange, textarea } = renderInput();
    fireEvent.change(textarea, { target: { value: '/cam' } });

    expect(screen.getByTestId('agent-skill-option-campaign')).toBeTruthy();
    expect(screen.queryByTestId('agent-skill-option-caption')).toBeNull();

    fireEvent.mouseDown(screen.getByTestId('agent-skill-option-campaign'));
    expect((textarea as HTMLTextAreaElement).value).toBe('/campaign ');
    expect(onChange).toHaveBeenLastCalledWith('/campaign ');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('closes suggestions once the first slash token is followed by arguments', () => {
    const { textarea } = renderInput();
    fireEvent.change(textarea, { target: { value: '/cam draft a post' } });
    expect(screen.queryByTestId('agent-skill-suggestions')).toBeNull();
  });

  it('uses keyboard selection, escape, IME, and ordinary Enter correctly', () => {
    const { onSend, textarea } = renderInput();
    fireEvent.change(textarea, { target: { value: '/' } });
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'ArrowDown' });
    fireEvent.keyDown(textarea, { key: 'Tab' });
    expect((textarea as HTMLTextAreaElement).value).toBe('/caption ');
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.change(textarea, { target: { value: '/' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByTestId('agent-skill-suggestions')).toBeNull();

    fireEvent.change(textarea, { target: { value: '/campaign' } });
    fireEvent.compositionStart(textarea);
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.compositionEnd(textarea);

    fireEvent.change(textarea, { target: { value: 'manual command' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('manual command');
  });

  it('does not block manual commands when the catalog fails', () => {
    useAgentSkills.mockReturnValue({ data: [], error: new Error('failed'), isLoading: false });
    const { onSend, textarea } = renderInput();
    fireEvent.change(textarea, { target: { value: '/manual' } });
    expect(screen.getByText(/Skills are unavailable/)).toBeTruthy();
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('/manual');
  });

  it('sends completed slash commands with arguments on Enter', () => {
    const { onSend, textarea } = renderInput();
    fireEvent.change(textarea, {
      target: { value: '/campaign-review draft text' },
    });
    expect(screen.queryByTestId('agent-skill-suggestions')).toBeNull();
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('/campaign-review draft text');
  });

  it('sends an exact completed command on Enter without selecting a suggestion', () => {
    const { onSend, textarea } = renderInput();
    fireEvent.change(textarea, { target: { value: '/campaign' } });
    expect(screen.queryByTestId('agent-skill-suggestions')).toBeNull();
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('/campaign');
  });
});
