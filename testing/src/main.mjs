import { CNShell } from "cn-shell";

let $ = new CNShell({
  name: "Test",
  appVersion: "0.0.0",
  log: { level: "TRACE", timestamp: "N", timestampFormat: "" },
  // http: {
  //   healthcheckInterface: "lo",
  //   healthcheckPath: "/hello",
  // },
});

await $.init();

$.info("Hello world");

// $.healthcheckCallback = (req, res) => {
//   $.info("Got %s", req.url);
//   $.info("headers %j", req.rawHeaders);

//   var body = "";
//   req.on("data", function (data) {
//     body += data;
//     console.log("Partial body: " + body);
//   });
//   req.on("end", function () {
//     console.log("Body: " + body);
//     res.write("hello");
//     res.end("post received");
//   });
// };

let res = await $.httpReq("http://localhost:3000", "/", {
  method: "POST",
  // headers: { "content-type": "application/ddd; charset=utf-8" },
  body: { a: 1 },
});

$.info("%s", typeof res.body);
$.info("%j", res);
// let age = await $.question("How old are you?", {
//   muteAnswer: true,
//   muteChar: "#",
// });
// $.warn("Age is %s", age);

// let files = $.sh.ls(".");

// $.info(files);
// for (let file of files) {
//   $.info("File: %s", file);
//   $.info($.sh.cat(`./${file}`));
// }
