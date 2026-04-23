// Fixture with deliberate errors for testing

const unused = 42; // no-unused-vars error

let x = 1;
x = 2; // prefer-const error

if (1 == 2) { // eqeqeq error
  console.log('test'); // no-console warning
}
