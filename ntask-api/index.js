import express from "express";
import consign from "consign";

const app = express();

consign({verbose: false})
  .include("libs/config.js")
  .then("db.js")
  .then("auth.js")
  .then("libs/middlewares.js")
  .then("routes")
  .then("libs/boot.js")
  .into(app);

module.exports = app;
