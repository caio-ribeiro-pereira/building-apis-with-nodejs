module.exports = app => {
  const Tasks = app.db.models.Tasks;
  app.get("/tasks", (req, res) => {
    Tasks.findAll({}).then(tasks => {
      res.json({tasks: tasks});
    });
  });
};
