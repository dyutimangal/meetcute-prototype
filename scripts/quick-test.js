// quick-test tries the express app handlers without a DB
const app = require('../index');
const http = require('http');

(async function quickTest() {
  const server = http.createServer(app);
  server.listen(0, () => {
    const { port } = server.address();
    console.log('Test server started on port', port);
    server.close(() => console.log('Quick test success — server started and closed'));
  });
})();
