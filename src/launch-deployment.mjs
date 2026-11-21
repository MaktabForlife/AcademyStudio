import {WorkerEntrypoint} from 'cloudflare:workers';
import {runtimeFor} from '../security/v2/runtime.mjs';
import {runOfflineUpdateStep} from '../security/v2/offline-operations.mjs';

export {default} from './launch-worker.mjs';

export class V111OfflineUpdate extends WorkerEntrypoint {
  async step(command) {
    const runtime = await runtimeFor(this.env, {app: 'studio'});
    return runOfflineUpdateStep(runtime, command);
  }
}
