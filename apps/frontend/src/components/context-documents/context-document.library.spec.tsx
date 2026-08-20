/**
 * @jest-environment ./jest.jsdom.environment.js
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ContextDocumentLibrary } from './context-document.library';

const mutate = jest.fn();
const uploadDocument = jest.fn();
const deleteDocument = jest.fn();
const decisionOpen = jest.fn();

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: any) => <>{children}</>,
}));
jest.mock('remark-gfm', () => ({}));
jest.mock('@mantine/hooks', () => ({
  useClickOutside: () => React.createRef<HTMLDivElement>(),
}));
jest.mock('@gitroom/react/form/button', () => ({
  Button: ({ children, loading: _loading, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));
jest.mock('@gitroom/react/toaster/toaster', () => ({
  useToaster: () => ({ show: jest.fn() }),
}));
jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (_key: string, fallback: string) => fallback,
}));
jest.mock('@gitroom/frontend/components/layout/loading', () => ({
  __esModule: true,
  default: () => null,
  LoadingComponent: () => null,
}));
jest.mock('@gitroom/frontend/components/layout/new-modal', () => ({
  useDecisionModal: () => ({ open: decisionOpen }),
  useModals: () => ({ openModal: jest.fn() }),
}));
jest.mock('./use.context-document.list', () => ({
  useContextDocumentList: () => ({
    data: [
      {
        id: 'skill-1',
        organizationId: 'org-1',
        name: 'campaign-review.skill.md',
        fileSize: 12,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        isLarge: false,
        skill: {
          slug: 'campaign-review',
          command: '/campaign-review',
          conflict: false,
        },
      },
      {
        id: 'reserved-1',
        organizationId: 'org-1',
        name: 'followers.skill.md',
        fileSize: 12,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        isLarge: false,
        skill: { slug: 'followers', command: '/followers', conflict: true },
      },
    ],
    isLoading: false,
    mutate,
  }),
}));
jest.mock('./use.context-document.upload', () => ({
  useContextDocumentUpload: () => uploadDocument,
}));
jest.mock('./use.context-document.delete', () => ({
  useContextDocumentDelete: () => deleteDocument,
}));
jest.mock('./use.context-document.content', () => ({
  useContextDocumentContent: () => ({}),
}));

describe('ContextDocumentLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    decisionOpen.mockResolvedValue(true);
    uploadDocument.mockResolvedValue({ id: 'skill-1' });
    deleteDocument.mockResolvedValue({ id: 'reserved-1' });
  });

  it('shows skill commands and marks reserved legacy skills as conflicts', () => {
    render(<ContextDocumentLibrary />);

    expect(screen.getByText('Skill · /campaign-review')).toBeTruthy();
    expect(screen.getByText('Skill conflict · /followers')).toBeTruthy();
    expect(screen.getByText(/cannot be invoked/i)).toBeTruthy();
  });

  it('confirms replacement and refreshes the library after a skill upload', async () => {
    const { container } = render(<ContextDocumentLibrary />);
    const actions = screen.getAllByLabelText('Document actions');
    fireEvent.click(actions[0]);
    fireEvent.click(screen.getByText('Replace'));

    const input = container.querySelector('input[type="file"]')!;
    const file = new File(['# Updated'], 'campaign-review.skill.md', {
      type: 'text/markdown',
    });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(decisionOpen).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Replace existing document?' })
      )
    );
    await waitFor(() => expect(uploadDocument).toHaveBeenCalledWith(file));
    expect(mutate).toHaveBeenCalled();
  });

  it('deletes reserved skill conflicts through the management library', async () => {
    render(<ContextDocumentLibrary />);
    const actions = screen.getAllByLabelText('Document actions');
    fireEvent.click(actions[1]);
    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => expect(deleteDocument).toHaveBeenCalledWith('reserved-1'));
    expect(mutate).toHaveBeenCalled();
  });
});
