let { CNShell } = require("cn-shell");

(async () => {
  let $ = new CNShell({
    name: "Test",
    appVersion: "0.0.0",
    log: { level: "STARTUP", timestamp: "Y", timestampFormat: "" },
    http: {
      keepAliveTimeout: 1,
      headerTimeout: 2,

      healthcheckPort: 6969,
      healthcheckInterface: "enp0s5",
      healthcheckPath: "/hello",
      healthcheckGoodRes: 222,
      healthcheckBadRes: 555,
    },
  });
  await $.init();

  $.info("Hello world");
})();
