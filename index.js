var Worker  = require('./hamster-worker')
  , tasks   = require('./tasks.json')
  , worker  = new Worker(tasks[0]);


worker.execute(function(err){
  if(err){
    return console.log(err);
  }
  console.log("Success !");
});