var async     = require('async')
  , fs        = require('fs')
  , zlib      = require('zlib')
  , path      = require('path')
  , archiver  = require('archiver')
  , control   = require('control')
  , exec      = require('child_process').exec;
 


var Hamster=module.exports=function(config){
  this.config=config;
  this.baseFolder="/home/maxk/hamster_test_release/",
  this.serverWorkDir= "~/uploads/";
}


Hamster.prototype.execute=function(callback){
  async.waterfall([
      this.validate.bind(this),
      this.sign.bind(this),
      this.pack.bind(this),
      this.deploy.bind(this),
  ],callback);
}


Hamster.prototype.validate=function(callback){
  this.checkFiles(callback);
}

Hamster.prototype.checkFiles=function(callback){
  async.every(this.config.files,check_file_exists.bind(this),function(result){
    if(!result){
      return callback("Some files do not exist");
    }
    callback(null);
  });


  function check_file_exists(file,callback){
    file = path.join(this.getSourceFolder(),file);
    fs.exists(file, callback);
  }
}

Hamster.prototype.sign=function(callback){


  async.reject(this.config.sign,sign_one_file.bind(this),
    function(results){
        var filenames
          , err;
        if(results.length>0){
          err="Error. Could not sign the following files: ";
          filenames=[];
          for(var i=0,len=results.length;i<len;i++){
            filenames.push(results[i].file);
          }
          return callback("Error. Could not sign the following files: "+ filenames.join(","));
        }
        callback(null);
    });

  function sign_one_file(sign,callback){
    var spc=path.join(this.getCertificatesFolder(),sign.spc)
      , key=path.join(this.getKeyFolder(),sign.key)
      , file=path.join(this.getSourceFolder(),sign.file)
      , backup= path.join(this.getBackupFolder(),sign.file)
      , command;

      command="osslsigncode -spc \""+spc+"\"";
      command+=" -key \""+key+"\"";
      command+=" -t \"http://timestamp.verisign.com/scripts/timstamp.dll\"";
      command+=" -in \""+backup+"\"";
      command+=" -out \""+file+"\"";
      console.log(command);
      async.waterfall([
        function(callback){
          fs.exists(backup,function(exists){
            if(!exists){
              exec("cp " + file + " " + backup,callback);
            }else{
              callback(null,false,false);
            }
          });
        },
        function(stdout,stderr,callback){
          exec(command,function(err,stdout,stderr){
            if(err){
              return callback(false);
            }
            callback(true);
          });
        },
      ],callback);   
  }
}


Hamster.prototype.pack=function(callback){
  var gzipper = zlib.createGzip()
    , output  = fs.createWriteStream(this.getDistPath())
    , archive = archiver('tar')
    , file;

  archive.on('error',archive_finalizer);

  archive.pipe(gzipper).pipe(output);

  for (var i=0,len=this.config.files.length;i<len;i++){
    file=path.join(this.getSourceFolder(),this.config.files[i]);
    archive.append(fs.createReadStream(file),{name:this.config.files[i]});
  }

  archive.finalize(archive_finalizer);



  function archive_finalizer(err,written){
    if(err){
      calback(err);
    }
    console.log(written + ' total bytes written');
    callback(null);
  }


}

Hamster.prototype.deploy=function(callback){
  var controllers= this.getSshControllers();
  async.each(controllers,this.deployToOneServer.bind(this),callback);
}


Hamster.prototype.deployToOneServer=function(ssh_controller,callback){

  async.waterfall([
    function(callback){
      callback(null,ssh_controller);
    },
    this.prepareRemoteFolder.bind(this),
    this.uploadDistPack.bind(this),
    this.unpackRemote.bind(this),
    this.putToPlace.bind(this),
  ],callback);
  
}


Hamster.prototype.prepareRemoteFolder=function(controller,callback){
  var command="mkdir -p "+ this.getServerWorkDir();
  controller.ssh(command,arguments_callback(controller,callback));
}

Hamster.prototype.uploadDistPack=function(controller,callback){

  controller.scp(
    this.getDistPath(),
    this.getServerWorkDir(),
    arguments_callback(controller,callback)
  );
}


Hamster.prototype.unpackRemote=function(controller,callback){
  //unpack tar.gz and remove archive
  var command="tar xzvf ";
  command+=path.join(this.getServerWorkDir(),'dist.tar.gz'); 
  command+= " -C " + this.getServerWorkDir()+" && rm "+path.join(this.getServerWorkDir(),'dist.tar.gz');
  controller.ssh(command,arguments_callback(controller,callback));
}

Hamster.prototype.putToPlace=function(controller,callback){
  var commands=[]
    , tasks=this.config.deploy
    , command;

  for(var file in tasks){
    if(tasks.hasOwnProperty(file)){
      command = 'mkdir -p ' + tasks[file].dir+" && ";
      command+= 'mv '+ path.join(this.getServerWorkDir(),file);
      command+= ' '  + path.join(tasks[file].dir,tasks[file].name);
      commands.push(command);
    }
  }
  controller.ssh(commands.join("; "),callback);
}


Hamster.prototype.getBase=function(){
  return path.join(this.baseFolder, this.config.project, this.config.release);
}

Hamster.prototype.getDistPath=function(){
  return path.join(this.getBase(),"dist.tar.gz");
}

Hamster.prototype.getSourceFolder=function(){
  return path.join(this.getBase(),"src");
}

Hamster.prototype.getCertificatesFolder=function(){
  return path.join(this.getBase(),"certificates");
}

Hamster.prototype.getKeyFolder=function(){
  return path.join(this.getBase(),"keys");
}

Hamster.prototype.getBackupFolder=function(){
  return path.join(this.getBase(),"backup");
}


Hamster.prototype.getServerWorkDir=function(){
  return path.join(this.serverWorkDir,this.config.project,this.config.release);
}




Hamster.prototype.getSshControllers=function(){
  var shared = Object.create(control.controller)
    , sharedConfig = this.config.shared
    , servers = this.config.servers
    , controllers;

  for(var key in sharedConfig){
    if(sharedConfig.hasOwnProperty(key)){
      shared[key] = sharedConfig[key];
    }
  }

  return control.controllers(servers,shared);
}







function arguments_callback(){
  var args=Array.prototype.slice.apply(arguments)
    , callback = args.pop();
  return function(err){
    args.unshift(err);
    callback.apply(null,args);
  };
}


