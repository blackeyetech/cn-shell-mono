const express = require("express");
const app = express();
const port = 3000;

app.use(express.json());

app.post("/", (req, res) => {
  console.log(req.body);
  // res.type("application/json");
  res.status(200);
  // res.end();
  res.send({ msg: "Good job" }).end();

  console.log(req.headers);
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
