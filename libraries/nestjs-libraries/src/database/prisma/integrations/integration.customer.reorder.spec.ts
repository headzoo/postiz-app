import { IntegrationRepository } from './integration.repository';

type CustomerRow = {
  id: string;
  orgId: string;
  name: string;
  position: number;
  deletedAt?: Date | null;
};

function createRepository(customers: CustomerRow[]) {
  const repository = Object.create(
    IntegrationRepository.prototype
  ) as IntegrationRepository;
  const customerModel = {
    findMany: jest.fn(async ({ where, orderBy, select }: any) => {
      const rows = customers
        .filter(
          (customer) =>
            customer.orgId === where.orgId && customer.deletedAt == null
        )
        .sort((left, right) => {
          for (const order of orderBy || []) {
            if (order.position) {
              const diff = left.position - right.position;
              if (diff) {
                return order.position === 'asc' ? diff : -diff;
              }
            }
            if (order.name) {
              const diff = left.name.localeCompare(right.name);
              if (diff) {
                return order.name === 'asc' ? diff : -diff;
              }
            }
          }
          return 0;
        });
      if (select) {
        return rows.map((customer) => ({
          id: customer.id,
          position: customer.position,
        }));
      }
      return rows;
    }),
    findFirst: jest.fn(async ({ where, orderBy }: any) => {
      const rows = customers.filter((customer) => {
        if (where.id && customer.id !== where.id) {
          return false;
        }
        if (where.NOT?.id && customer.id === where.NOT.id) {
          return false;
        }
        if (where.orgId && customer.orgId !== where.orgId) {
          return false;
        }
        if (where.name && customer.name !== where.name) {
          return false;
        }
        if (where.deletedAt === null && customer.deletedAt) {
          return false;
        }
        return true;
      });
      if (orderBy?.position === 'desc') {
        rows.sort((left, right) => right.position - left.position);
      }
      return rows[0] || null;
    }),
    create: jest.fn(async ({ data }: any) => {
      const created = {
        id: data.id || `created-${customers.length}`,
        orgId: data.orgId,
        name: data.name,
        position: data.position,
        deletedAt: null,
      };
      customers.push(created);
      return created;
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const customer = customers.find((item) => item.id === where.id);
      if (customer && data.position !== undefined) {
        customer.position = data.position;
      }
      if (customer && data.name !== undefined) {
        customer.name = data.name;
      }
      return customer;
    }),
  };
  (repository as any)._customers = { model: { customer: customerModel } };
  (repository as any)._integration = {
    model: {
      integration: {
        update: jest.fn(async (args: any) => args),
      },
    },
  };
  return { repository, customerModel };
}

describe('IntegrationRepository customer reorder', () => {
  it('swaps a customer up with its neighbor', async () => {
    const { repository, customerModel } = createRepository([
      { id: 'alpha', orgId: 'org', name: 'Alpha', position: 0 },
      { id: 'beta', orgId: 'org', name: 'Beta', position: 1 },
      { id: 'gamma', orgId: 'org', name: 'Gamma', position: 2 },
    ]);

    await expect(
      repository.reorderCustomer('org', 'beta', 'up')
    ).resolves.toEqual({ id: 'beta', position: 0 });
    expect(customerModel.update).toHaveBeenCalledTimes(2);
    await expect(repository.customers('org')).resolves.toEqual([
      expect.objectContaining({ id: 'beta', position: 0 }),
      expect.objectContaining({ id: 'alpha', position: 1 }),
      expect.objectContaining({ id: 'gamma', position: 2 }),
    ]);
  });

  it('swaps a customer down with its neighbor', async () => {
    const { repository } = createRepository([
      { id: 'alpha', orgId: 'org', name: 'Alpha', position: 0 },
      { id: 'beta', orgId: 'org', name: 'Beta', position: 1 },
    ]);

    await expect(
      repository.reorderCustomer('org', 'alpha', 'down')
    ).resolves.toEqual({ id: 'alpha', position: 1 });
    await expect(repository.customers('org')).resolves.toEqual([
      expect.objectContaining({ id: 'beta', position: 0 }),
      expect.objectContaining({ id: 'alpha', position: 1 }),
    ]);
  });

  it('returns false at the list boundaries', async () => {
    const { repository, customerModel } = createRepository([
      { id: 'alpha', orgId: 'org', name: 'Alpha', position: 0 },
      { id: 'beta', orgId: 'org', name: 'Beta', position: 1 },
    ]);

    await expect(
      repository.reorderCustomer('org', 'alpha', 'up')
    ).resolves.toBe(false);
    await expect(
      repository.reorderCustomer('org', 'beta', 'down')
    ).resolves.toBe(false);
    expect(customerModel.update).not.toHaveBeenCalled();
  });

  it('returns null for a missing or foreign customer', async () => {
    const { repository } = createRepository([
      { id: 'alpha', orgId: 'org', name: 'Alpha', position: 0 },
      { id: 'other', orgId: 'other-org', name: 'Other', position: 0 },
    ]);

    await expect(
      repository.reorderCustomer('org', 'missing', 'down')
    ).resolves.toBeNull();
    await expect(
      repository.reorderCustomer('org', 'other', 'down')
    ).resolves.toBeNull();
  });

  it('assigns the next position when creating a customer', async () => {
    const { repository, customerModel } = createRepository([
      { id: 'alpha', orgId: 'org', name: 'Alpha', position: 4 },
    ]);

    await repository.updateOnCustomerName('org', 'integration', 'HarborClient');

    expect(customerModel.create).toHaveBeenCalledWith({
      data: {
        name: 'HarborClient',
        orgId: 'org',
        position: 5,
      },
    });
  });

  it('renames a customer in the same organization', async () => {
    const { repository } = createRepository([
      { id: 'alpha', orgId: 'org', name: 'Alpha', position: 0 },
    ]);

    await expect(
      repository.renameCustomer('org', 'alpha', 'HarborClient')
    ).resolves.toEqual(
      expect.objectContaining({ id: 'alpha', name: 'HarborClient' })
    );
  });

  it('rejects a duplicate group name in the same organization', async () => {
    const { repository, customerModel } = createRepository([
      { id: 'alpha', orgId: 'org', name: 'Alpha', position: 0 },
      { id: 'beta', orgId: 'org', name: 'Beta', position: 1 },
    ]);

    await expect(
      repository.renameCustomer('org', 'alpha', 'Beta')
    ).resolves.toBe(false);
    expect(customerModel.update).not.toHaveBeenCalled();
  });

  it('returns null when renaming a missing customer', async () => {
    const { repository } = createRepository([
      { id: 'alpha', orgId: 'org', name: 'Alpha', position: 0 },
    ]);

    await expect(
      repository.renameCustomer('org', 'missing', 'HarborClient')
    ).resolves.toBeNull();
  });
});
