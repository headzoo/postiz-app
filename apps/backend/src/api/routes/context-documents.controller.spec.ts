import { ContextDocumentsController } from './context-documents.controller';

describe('ContextDocumentsController', () => {
  const organization = { id: 'org-1' } as any;
  const service = {
    listDocuments: jest.fn(),
    uploadDocument: jest.fn(),
    listSkills: jest.fn(),
    getSkillBySlug: jest.fn(),
    getDocumentById: jest.fn(),
    deleteDocument: jest.fn(),
  };
  const controller = new ContextDocumentsController(service as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses org-scoped services for static skill routes', async () => {
    service.listSkills.mockResolvedValue([]);
    service.getSkillBySlug.mockResolvedValue({ slug: 'campaign-review' });

    await expect(controller.listSkills(organization)).resolves.toEqual([]);
    await expect(
      controller.getSkill(organization, 'campaign-review')
    ).resolves.toEqual({ slug: 'campaign-review' });

    expect(service.listSkills).toHaveBeenCalledWith('org-1');
    expect(service.getSkillBySlug).toHaveBeenCalledWith(
      'org-1',
      'campaign-review'
    );
  });
});
