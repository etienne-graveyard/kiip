import React from 'react';
import { Kiip, Items, KiipDatabase, MerkleTreeSyncMessage } from '@kiip/core';

function MemoryDb<T>(): KiipDatabase<T> {
  const data: Items<T> = [];

  return {
    async getItems(tss) {
      return tss.map((ts) => {
        const item = data.find((item) => item.ts.equal(ts));
        if (!item) {
          console.log(ts);
          throw new Error(`Cannot find ${ts}`);
        }
        return item;
      });
    },
    async update(_tree, _clock, items) {
      data.push(...items);
    },
  };
}

let time = Math.floor(Date.now() / 1000);

const clientA = Kiip.create<string>('00000001', MemoryDb(), {
  now: () => time,
});
const clientB = Kiip.create<string>('00000002', MemoryDb());

(window as any).clientA = clientA;
(window as any).clientB = clientB;
(window as any).logTrees = logTrees;

function logTrees() {
  console.log(clientA.getState().tree.toString());
  console.log(clientB.getState().tree.toString());
}

async function sync(client: Kiip<string>, otherClient: Kiip<string>) {
  const message = client.prepareSync();
  console.log(message);
  send(otherClient, client, message);
}

console.log(new Date(time * 1000));

let count = 0;

for (let k = 1; k < 5; k++) {
  time = Math.floor(time + Math.random() * 60 * 60 * 24);
  for (let j = 1; j < 6; j++) {
    time = Math.floor(time + Math.random() * 60 * 60 * 4);
    for (let i = 1; i < 60; i++) {
      time = Math.floor(time + Math.random() * 60);
      count++;
      clientA.commit(i.toString());
    }
  }
  const strLength = JSON.stringify(clientA.getState().tree).length;
  console.log(count, strLength, strLength / count);
}

console.log(new Date(time * 1000));

// console.log(JSON.stringify(clientA.getState().tree));
// console.log(clientA.getState().tree);

async function send(
  client: Kiip<string>,
  otherClient: Kiip<string>,
  message: MerkleTreeSyncMessage,
) {
  const next = await client.handleSync(message);
  // await wait(Math.floor(Math.random() * 1000));
  const items = next.items === null ? [] : next.items;
  const responses = next.responses === null ? [] : next.responses;
  if (items.length > 0) {
    console.log(items);
  }
  if (responses.length === 0) {
    console.log('done');
  }
  await otherClient.handleItems(items);
  responses.forEach((response) => {
    console.log(response);
    send(otherClient, client, response);
  });
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export const Client: React.FC<{
  name: string;
  client: Kiip<string>;
  otherClient: Kiip<string>;
}> = ({ name, client, otherClient }) => {
  const [count, setCount] = React.useState(0);

  const [items, setItems] = React.useState<Items<string>>([]);

  React.useEffect(() => {
    return client.onItems((items) => {
      setItems((prev) =>
        [...prev, ...items].sort((l, r) => l.ts.compare(r.ts)),
      );
    });
  }, [client]);

  const countRef = React.useRef(count);
  React.useEffect(() => {
    countRef.current = count;
  }, [count]);

  const commit = React.useCallback(() => {
    client.commit(name + '-' + countRef.current);
    setCount((p) => p + 1);
  }, []);

  // React.useEffect(() => {
  //   async function run() {
  //     commit();
  //     await wait(Math.floor(Math.random() * 1000));
  //     run();
  //   }
  //   run();
  // }, []);

  // React.useEffect(() => {
  //   async function run() {
  //     sync(client, otherClient);
  //     await wait(Math.floor(Math.random() * 4000));
  //     run();
  //   }
  //   run();
  // }, []);

  return (
    <div style={{ flex: 1, textAlign: 'center', margin: '2rem' }}>
      <h2>
        {name} - {count}
      </h2>
      <div>
        <button
          onClick={() => {
            commit();
          }}
        >
          Add
        </button>
        <br />
        <button onClick={() => sync(client, otherClient)}>Sync</button>
      </div>
      <div>
        {items.map((item) => (
          <span key={item.ts.toString()}>{' ' + item.payload + ' '}</span>
        ))}
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        padding: '0 1rem',
      }}
    >
      <Client client={clientA} otherClient={clientB} name="A" />
      <Client client={clientB} otherClient={clientA} name="B" />
    </div>
  );
};
