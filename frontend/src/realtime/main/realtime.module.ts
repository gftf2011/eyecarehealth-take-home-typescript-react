import type { LiveEventBus, Scheduler } from '../../shared-kernel/application';
import { LiveConnection, type RealtimeSocketFactory, type RealtimeTokenSource } from '../application';
import { BrowserRealtimeSocketFactory } from '../infra';

export type RealtimeModuleOptions = {
  /** `ws(s)://<origem>/realtime`. */
  readonly url: string;
  readonly tokens: RealtimeTokenSource;
  readonly events: LiveEventBus;
  readonly scheduler: Scheduler;
  readonly sockets?: RealtimeSocketFactory;
  readonly random?: () => number;
};

export type RealtimeModule = {
  readonly connection: LiveConnection;
};

/** Composition root do Realtime. */
export function createRealtimeModule(options: RealtimeModuleOptions): RealtimeModule {
  return {
    connection: new LiveConnection({
      sockets: options.sockets ?? new BrowserRealtimeSocketFactory(options.url),
      tokens: options.tokens,
      events: options.events,
      scheduler: options.scheduler,
      random: options.random ?? Math.random,
    }),
  };
}
