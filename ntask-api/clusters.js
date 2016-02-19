import cluster from "cluster";
import os from "os";

const CPUS = os.cpus();
if (cluster.isMaster) {
  CPUS.forEach(() => cluster.fork());
  cluster.on("listening", worker => {
    console.log("Cluster %d connected", worker.process.pid);
  });
  cluster.on("disconnect", worker => {
    console.log("Cluster %d disconnected", worker.process.pid);
  });
  cluster.on("exit", worker => {
    console.log("Cluster %d is dead", worker.process.pid);
    cluster.fork();
    // Ensure to starts a new cluster if an old one dies
  });
} else {
  require("./index.js");
}
