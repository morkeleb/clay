// Exports a class without a run method — should fail shape check
export default class {
  doStuff() {
    return 'not a hook';
  }
}
