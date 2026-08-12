let mockAgentOptions: { instructions: (context: any) => string };

jest.mock('@mastra/core/agent', () => ({
  Agent: class Agent {
    constructor(options: { instructions: (context: any) => string }) {
      mockAgentOptions = options;
    }
  },
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(),
}));

jest.mock('@mastra/memory', () => ({
  Memory: class Memory {},
}));

jest.mock('@gitroom/nestjs-libraries/chat/mastra.store', () => ({
  pStore: {},
}));

jest.mock('@gitroom/nestjs-libraries/chat/tools/tool.list', () => ({
  toolList: [],
}));

import {
  LoadToolsService,
  renderSelectedPipelineGuidance,
  SelectedPipelineContext,
} from './load.tools.service';

const selectedPipeline: SelectedPipelineContext = {
  id: 'pipeline-1',
  name: 'Product Launch',
  timezone: 'America/New_York',
  active: true,
  channels: [
    {
      id: 'channel-1',
      name: 'Postiz on X',
      platform: 'x',
      picture: 'https://example.com/x.png',
    },
  ],
  contextDocuments: [
    {
      id: 'document-1',
      name: 'BRAND.md',
      fileSize: 123,
      updatedAt: '2026-08-11T12:00:00.000Z',
    },
  ],
};

describe('renderSelectedPipelineGuidance', () => {
  it('includes the selected pipeline identity and refresh guidance', () => {
    const guidance = renderSelectedPipelineGuidance(selectedPipeline);

    expect(guidance).toContain('id: pipeline-1');
    expect(guidance).toContain('Product Launch');
    expect(guidance).toContain('Postiz on X (x, id: channel-1)');
    expect(guidance).toContain('BRAND.md (id: document-1, 123 bytes');
    expect(guidance).toContain('listPipelines to refresh and validate');
    expect(guidance).toContain('not as authorization');
  });

  it('does not add selected-pipeline guidance without a selection', () => {
    expect(renderSelectedPipelineGuidance(null)).toBe('');
  });

  it('adds context guidance to the Mastra agent only when selected', async () => {
    const service = new LoadToolsService({ get: jest.fn() } as any);
    await service.agent();

    const withPipeline = mockAgentOptions.instructions({
      requestContext: {
        get: (key: string) => (key === 'pipeline' ? selectedPipeline : 'true'),
      },
    });
    const withoutPipeline = mockAgentOptions.instructions({
      requestContext: { get: () => null },
    });

    expect(withPipeline).toContain('id: pipeline-1');
    expect(withoutPipeline).not.toContain('User-selected pipeline target');
  });
});
