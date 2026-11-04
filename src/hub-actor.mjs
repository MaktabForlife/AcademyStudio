// Request-local capability; browser JSON cannot manufacture this identity.
const checked=new WeakSet();
export const markHubActor=actor=>{checked.add(actor);return actor;};
export const isHubActor=actor=>checked.has(actor);
