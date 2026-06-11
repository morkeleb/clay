// Prints its arguments to stderr and exits non-zero — used to test that
// precheck commands surface stderr and receive the model path as last arg.
console.error(`args: ${process.argv.slice(2).join(' ')}`);
process.exit(1);
