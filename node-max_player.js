// change process.cwd() to soundworks application root
process.chdir('../B3-MAX');
console.log('node running in:', process.cwd());
// import the client source file
import('../B3-MAX/src/clients/max_player.js');
