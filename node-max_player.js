// change process.cwd() to soundworks application root
process.chdir('../B3_H4RSH');
console.log('node running in:', process.cwd());
// import the client source file
import('../B3_H4RSH/src/clients/max_player.js');
