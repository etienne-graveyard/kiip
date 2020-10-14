const originalModule = jest.requireActual('../utils');

module.exports = {
  __esModule: true,
  ...originalModule,
  createId: jest.fn().mockImplementation(() => {
    return originalModule.createId();
  }),
};
