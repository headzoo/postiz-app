import { createContext, FC, ReactNode, useContext } from 'react';
import { Post } from '@prisma/client';

interface ExistingDataChannel {
  integration: string;
  posts: Post[];
  settings: Record<string, unknown>;
}

interface ExistingData {
  integration?: string;
  group?: string;
  posts: Post[];
  settings: Record<string, unknown>;
  channels?: ExistingDataChannel[];
}

const ExistingDataContext = createContext<ExistingData>({
  integration: '',
  group: undefined as undefined | string,
  posts: [] as Post[],
  settings: {},
});
export const ExistingDataContextProvider: FC<{
  children: ReactNode;
  value: any;
}> = ({ children, value }) => {
  return (
    <ExistingDataContext.Provider value={value}>
      {children}
    </ExistingDataContext.Provider>
  );
};
export const useExistingData = () => useContext(ExistingDataContext);
