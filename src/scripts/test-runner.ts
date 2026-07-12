import 'dotenv/config';
import('./scan-leaderboard.js').then(m => m.main ? m.main() : console.log('loaded'));
