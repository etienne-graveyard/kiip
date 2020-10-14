import * as utils from '../src/utils';

jest.mock('../src/utils', () => {
  const originalModule = jest.requireActual('../src/utils');
  return {
    __esModule: true,
    ...originalModule,
    createId: jest.fn().mockImplementation(() => {
      return originalModule.createId();
    }),
  };
});

export const RandomUtils = {
  mockNextId,
};

function mockNextId(id: string): void {
  (utils.createId as jest.Mock).mockImplementationOnce(() => {
    return id;
  });
}
