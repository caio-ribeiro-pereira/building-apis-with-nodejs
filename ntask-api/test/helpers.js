import supertest from "supertest";
import chai from "chai";
import app from "../index.js";

global.app = app;
global.request = supertest(app);
global.expect = chai.expect;
