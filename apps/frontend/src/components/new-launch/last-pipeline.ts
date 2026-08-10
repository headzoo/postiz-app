const LAST_PIPELINE_KEY = 'postiz-last-pipeline-id';

export const getLastPipelineId = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return localStorage.getItem(LAST_PIPELINE_KEY) || undefined;
};

export const setLastPipelineId = (pipelineId: string) => {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.setItem(LAST_PIPELINE_KEY, pipelineId);
};
