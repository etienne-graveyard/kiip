import { Kiip, KiipSchema, KiipDatabase, KiipOptions } from '@kiip/core';

export interface KiipClientServer {
  url: string;
  token: string;
}

export interface KiipClientMetadata {
  name: string;
  servers: Array<KiipClientServer>;
}

export interface KiipClient<Schema extends KiipSchema, Metadata> extends Kiip<Schema, Metadata & KiipClientMetadata> {}

export function KiipClient<Schema extends KiipSchema, Metadata>(
  database: KiipDatabase<unknown>,
  options: KiipOptions<Metadata>
): Kiip<Schema, Metadata & KiipClientMetadata> {
  const kiip = Kiip<Schema, Metadata & KiipClientMetadata>(database, {
    ...options,
    getInitialMetadata: () => ({
      ...options.getInitialMetadata(),
      name: 'New Document',
      servers: [],
    }),
  });

  return kiip;
}
