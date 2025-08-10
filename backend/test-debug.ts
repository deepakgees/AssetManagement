console.log('🔍 DEBUG: Test debug script starting...');

function testFunction() {
  console.log('🔍 DEBUG: Inside test function');
  return 'test result';
}

const result = testFunction();
console.log('🔍 DEBUG: Result:', result);

// Test async function
async function testAsyncFunction() {
  console.log('🔍 DEBUG: Inside async test function');
  await new Promise(resolve => setTimeout(resolve, 100));
  return 'async test result';
}

testAsyncFunction().then(result => {
  console.log('🔍 DEBUG: Async result:', result);
});

console.log('🔍 DEBUG: Test script completed');
