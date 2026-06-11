// Exports a class without a check method — should fail shape validation
export default class {
  doStuff() {
    return 'not a precheck';
  }
}
