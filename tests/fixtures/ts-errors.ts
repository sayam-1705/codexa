// TypeScript fixture with deliberate errors

interface User {
  name: string;
}

const user: User = unknownVariable; // no-undef error

function process(data: any) {
  const result = compute();
  return result; // unused variable
}

let value = 5;
value = 10; // prefer-const error
