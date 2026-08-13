/**
 * @jest-environment ./jest.jsdom.environment.js
 */

jest.mock('@gitroom/frontend/components/launches/add.provider.component', () => ({
  AddProviderButton: () => null,
}));

jest.mock('@gitroom/frontend/components/launches/generator/generator', () => ({
  GeneratorComponent: () => null,
}));

jest.mock('@gitroom/frontend/components/launches/new.post', () => ({
  NewPost: () => null,
}));

jest.mock('@gitroom/frontend/components/launches/helpers/dnd.provider', () => ({
  DNDProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@gitroom/react/helpers/variable.context', () => ({
  useVariables: () => ({ billingEnabled: false }),
}));

jest.mock('react-use-cookie', () => ({
  __esModule: true,
  default: jest.fn(() => ['0', jest.fn()]),
}));

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  ChannelMenu,
  groupChannelsByCustomer,
} from './channels.sidebar';
import { IntegrationListItem } from '@gitroom/frontend/components/launches/helpers/use.integration.list';

jest.mock('@gitroom/react/translation/get.transation.service.client', () => ({
  useT: () => (key: string, fallback?: string) => fallback || key,
}));

jest.mock('@gitroom/frontend/components/layout/user.context', () => ({
  useUser: () => ({ totalChannels: 10 }),
}));

jest.mock('react-dnd', () => ({
  useDrag: () => [{}, (node: unknown) => node, (node: unknown) => node],
  useDrop: () => [{ isOver: false }, (node: unknown) => node],
}));

jest.mock('@gitroom/react/helpers/image.with.fallback', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

jest.mock('@gitroom/react/helpers/safe.image', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

jest.mock('@gitroom/frontend/components/launches/menu/menu', () => ({
  Menu: () => <div data-testid="channel-kebab" />,
}));

const makeIntegration = (
  id: string,
  name: string,
  overrides: Partial<IntegrationListItem> = {}
): IntegrationListItem =>
  ({
    id,
    name,
    identifier: `platform-${id}`,
    type: 'social',
    picture: `/picture/${id}.png`,
    disabled: false,
    inBetweenSteps: false,
    changeProfilePicture: false,
    changeNickName: false,
    ...overrides,
  }) as IntegrationListItem;

const acmeOne = makeIntegration('acme-1', 'Acme One', {
  customer: { id: 'acme', name: 'Acme' },
});
const acmeTwo = makeIntegration('acme-2', 'Acme Two', {
  customer: { id: 'acme', name: 'Acme' },
});
const betaOne = makeIntegration('beta-1', 'Beta One', {
  customer: { id: 'beta', name: 'Beta' },
});
const ungrouped = makeIntegration('solo-1', 'Solo Channel');

describe('groupChannelsByCustomer', () => {
  it('groups channels by customer and sorts named groups first by name', () => {
    const groups = groupChannelsByCustomer([betaOne, ungrouped, acmeTwo, acmeOne]);

    expect(groups.map((group) => group.name)).toEqual(['', 'Acme', 'Beta']);
    expect(groups[1].values.map((integration) => integration.id)).toEqual([
      'acme-1',
      'acme-2',
    ]);
  });
});

describe('ChannelMenu', () => {
  it('renders customer group headers and channels', () => {
    render(
      <ChannelMenu
        collapsed={false}
        integrations={[acmeOne, acmeTwo, betaOne, ungrouped]}
      />
    );

    expect(screen.getByRole('button', { name: 'Acme' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Beta' })).toBeTruthy();
    expect(screen.getByText('Acme One')).toBeTruthy();
    expect(screen.getByText('Acme Two')).toBeTruthy();
    expect(screen.getByText('Beta One')).toBeTruthy();
    expect(screen.getByText('Solo Channel')).toBeTruthy();
    expect(screen.queryByTestId('channel-kebab')).toBeNull();
  });

  it('collapses a named group when its header is clicked', () => {
    render(
      <ChannelMenu
        collapsed={false}
        integrations={[acmeOne, betaOne]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Acme' }));

    expect(
      screen.getByText('Acme One').closest('div.flex.flex-col')?.className
    ).toContain('hidden');
    expect(
      screen.getByText('Beta One').closest('div.flex.flex-col')?.className
    ).not.toContain('hidden');
  });

  it('dims unselected channels and reports clicks', () => {
    const onSelect = jest.fn();
    render(
      <ChannelMenu
        collapsed={false}
        integrations={[acmeOne, betaOne]}
        selectedIds={[acmeOne.id]}
        onSelect={onSelect}
      />
    );

    const selectedRow = screen.getByText('Acme One').closest('div.flex');
    const unselectedRow = screen.getByText('Beta One').closest('div.flex');

    expect(selectedRow?.className).not.toContain('opacity-20');
    expect(unselectedRow?.className).toContain('opacity-20');

    fireEvent.click(screen.getByText('Beta One'));
    expect(onSelect).toHaveBeenCalledWith(betaOne);
  });
});
