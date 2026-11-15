import 'dotenv/config';
import { startServer } from './server.js';

startServer().catch((err) => {
  console.error('Fatal error during GradeSTAR API startup:', err);
  process.exit(1);
});
