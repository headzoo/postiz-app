import { BadRequestException } from '@nestjs/common';
import { UsersRepository } from './users.repository';

describe('UsersRepository dashboard analytics preferences', () => {
  const createRepository = () => {
    const findManyPreferences = jest.fn();
    const findManyIntegrations = jest.fn();
    const deleteMany = jest.fn();
    const createMany = jest.fn();
    const transaction = jest.fn(async (callback: (tx: any) => Promise<void>) =>
      callback({
        dashboardAnalyticsPreference: {
          deleteMany,
          createMany,
        },
      })
    );

    const repository = Object.create(
      UsersRepository.prototype
    ) as UsersRepository;
    (repository as any)._dashboardAnalyticsPreference = {
      model: {
        dashboardAnalyticsPreference: {
          findMany: findManyPreferences,
        },
      },
    };
    (repository as any)._integration = {
      model: {
        integration: {
          findMany: findManyIntegrations,
        },
      },
    };
    (repository as any)._transaction = {
      model: {
        $transaction: transaction,
      },
    };

    return {
      repository,
      findManyPreferences,
      findManyIntegrations,
      deleteMany,
      createMany,
      transaction,
    };
  };

  it('rejects preferences for integrations outside the organization', async () => {
    const { repository, findManyIntegrations } = createRepository();
    findManyIntegrations.mockResolvedValue([{ id: 'integration-1' }]);

    await expect(
      repository.saveDashboardAnalyticsPreferences('user-1', 'org-1', [
        {
          integrationId: 'integration-1',
          metricKey: 'impressions',
          position: 0,
          hidden: false,
        },
        {
          integrationId: 'missing',
          metricKey: 'likes',
          position: 1,
          hidden: false,
        },
      ])
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate metric preferences', async () => {
    const { repository, findManyIntegrations } = createRepository();
    findManyIntegrations.mockResolvedValue([{ id: 'integration-1' }]);

    await expect(
      repository.saveDashboardAnalyticsPreferences('user-1', 'org-1', [
        {
          integrationId: 'integration-1',
          metricKey: 'impressions',
          position: 0,
          hidden: false,
        },
        {
          integrationId: 'integration-1',
          metricKey: 'impressions',
          position: 1,
          hidden: true,
        },
      ])
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replaces preferences for owned integrations', async () => {
    const {
      repository,
      findManyIntegrations,
      findManyPreferences,
      deleteMany,
      createMany,
      transaction,
    } = createRepository();
    findManyIntegrations.mockResolvedValue([{ id: 'integration-1' }]);
    findManyPreferences.mockResolvedValue([
      {
        integrationId: 'integration-1',
        metricKey: 'impressions',
        position: 0,
        hidden: false,
      },
    ]);

    await expect(
      repository.saveDashboardAnalyticsPreferences('user-1', 'org-1', [
        {
          integrationId: 'integration-1',
          metricKey: 'impressions',
          position: 0,
          hidden: false,
        },
        {
          integrationId: 'integration-1',
          metricKey: 'likes',
          position: 1,
          hidden: true,
        },
      ])
    ).resolves.toEqual([
      {
        integrationId: 'integration-1',
        metricKey: 'impressions',
        position: 0,
        hidden: false,
      },
    ]);

    expect(transaction).toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        organizationId: 'org-1',
        integrationId: { in: ['integration-1'] },
      },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: 'user-1',
          organizationId: 'org-1',
          integrationId: 'integration-1',
          metricKey: 'impressions',
          position: 0,
          hidden: false,
        },
        {
          userId: 'user-1',
          organizationId: 'org-1',
          integrationId: 'integration-1',
          metricKey: 'likes',
          position: 1,
          hidden: true,
        },
      ],
    });
  });
});
