const { define } = require('worktop.build');

// NOTE: Code inject into the TOP of the output file
const INJECT = `
  const window = self; // crypto, fetch, AbortController, etc
  window.open = () => window;
  let localStorage = window.localStorage = new (class Storage extends Object {
    getItem(k) { return this[k] }
    removeItem(k) { delete this[k] }
    setItem(k, v) { this[k] = v }
    clear() { localStorage = window.localStorage = new Storage }
  });
`;

module.exports = define({
	overrides: {
		banner: {
			js: INJECT
		}
	}
})
