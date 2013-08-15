var path = require('path')
  , Hamster =  require('../hamster-worker');




describe("Hamster worker", function(){
  var worker = new Hamster({

    "project": "test",
    "release": "123",
    "base": "~/hamster_test_release",
    "servers": ["amazon_test"],


    "shared": {
      "user": "imesh"
    },

    "files": [
        "file1.txt",
        "file2.txt",
        "file3.txt",
        "file4.txt"
    ],

    "certificates": [
        "certificate1.crt",
        "certificate2.crt"
    ],

    "sign": {
      "file1.txt": "certificate1.crt",
      "file2.txt": "certificate2.crt"
    },

    "deploy": {
      "file1.txt": "~/target/file1-uploaded.txt",
      "file2.txt": "~/target/file1-uploaded.txt"
    }
  });

  it("Should return the correct source folder",function(){
    expect(worker.getSourceFolder()).toEqual('~/hamster_test_release/')
  })
})