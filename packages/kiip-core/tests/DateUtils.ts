let MOCKED = false;

export const DateUtil = {
  applyMock,
  // tools
  reset,
  tick,
  setNow,
  mockNextCall,
};

type DateNowSpy = jest.SpyInstance<number, []>;

function applyMock(): void {
  if (MOCKED) {
    return;
  }
  MOCKED = true;
  jest.spyOn(Date, 'now').mockImplementation(() => {
    throw new Error('Empty Date Queue');
  }) as any;
}

function mockNextCall(val: number): void {
  if (!MOCKED) {
    applyMock();
  }
  ((Date.now as any) as DateNowSpy).mockImplementationOnce(() => val);
}

function reset(): void {
  if (!MOCKED) {
    applyMock();
  }
  ((Date.now as any) as DateNowSpy).mockReset().mockImplementation(() => {
    throw new Error('Empty Date Queue');
  });
}

function tick(millis: number = 1): void {
  if (!MOCKED) {
    applyMock();
  }
  const current = Date.now();
  ((Date.now as any) as DateNowSpy).mockReset().mockImplementation(() => {
    return current + millis;
  });
}

function setNow(time: number): void {
  if (!MOCKED) {
    applyMock();
  }
  ((Date.now as any) as DateNowSpy).mockReset().mockImplementation(() => {
    return time;
  });
}
